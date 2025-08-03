-- Create a function that automatically creates user records and organization when auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  org_id UUID;
  org_name TEXT;
  org_slug TEXT;
  user_full_name TEXT;
BEGIN
  -- Get full name from raw_user_meta_data or use email
  user_full_name := COALESCE(
    new.raw_user_meta_data->>'full_name',
    split_part(new.email, '@', 1)
  );
  
  -- Generate organization name and slug
  org_name := COALESCE(
    new.raw_user_meta_data->>'organization_name',
    user_full_name || '''s Organization'
  );
  
  org_slug := lower(regexp_replace(org_name, '[^a-z0-9]+', '-', 'g'));
  org_slug := regexp_replace(org_slug, '^-+|-+$', '', 'g');
  
  -- Ensure slug is unique
  WHILE EXISTS (SELECT 1 FROM organizations WHERE slug = org_slug) LOOP
    org_slug := org_slug || '-' || substr(gen_random_uuid()::text, 1, 8);
  END LOOP;

  -- Insert user record
  INSERT INTO public.users (id, email, full_name)
  VALUES (new.id, new.email, user_full_name)
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    updated_at = NOW();

  -- Only create organization if user doesn't have one
  IF NOT EXISTS (
    SELECT 1 FROM organization_members WHERE user_id = new.id
  ) THEN
    -- Create organization
    INSERT INTO organizations (
      name,
      slug,
      subscription_status,
      subscription_plan,
      created_by
    )
    VALUES (
      org_name,
      org_slug,
      'trial',
      'free',
      new.id
    )
    RETURNING id INTO org_id;

    -- Add user as owner
    INSERT INTO organization_members (
      organization_id,
      user_id,
      role,
      custom_permissions,
      status,
      accepted_at
    )
    VALUES (
      org_id,
      new.id,
      'owner',
      '{}'::jsonb,
      'active',
      NOW()
    );

    -- Update organization user count
    UPDATE organizations 
    SET current_users = 1
    WHERE id = org_id;
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Also handle updates (in case user confirms email later)
CREATE OR REPLACE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW 
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA auth TO service_role;
GRANT SELECT ON auth.users TO service_role;