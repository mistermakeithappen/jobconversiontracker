-- Migration: Add missing functions for API key management

-- Function to mark API key as used
CREATE OR REPLACE FUNCTION mark_api_key_used(key_id uuid)
RETURNS void AS $$
BEGIN
    UPDATE user_api_keys 
    SET last_used_at = NOW()
    WHERE id = key_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get table columns (for debugging)
CREATE OR REPLACE FUNCTION get_table_columns(table_name text)
RETURNS TABLE(column_name text, data_type text) AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        c.column_name::text,
        c.data_type::text
    FROM information_schema.columns c
    WHERE c.table_name = $1 
      AND c.table_schema = 'public'
    ORDER BY c.ordinal_position;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions for authenticated users
GRANT EXECUTE ON FUNCTION mark_api_key_used(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_table_columns(text) TO authenticated;