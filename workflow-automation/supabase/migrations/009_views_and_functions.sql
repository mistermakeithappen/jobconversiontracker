-- 009_views_and_functions.sql
-- Useful views and functions for the application

-- 1. User organization view
CREATE OR REPLACE VIEW user_organization_view AS
SELECT 
  om.user_id,
  om.organization_id,
  om.role,
  o.name as organization_name,
  o.slug as organization_slug,
  o.subscription_status,
  o.subscription_plan,
  o.trial_ends_at,
  o.subscription_ends_at
FROM organization_members om
JOIN organizations o ON om.organization_id = o.id
WHERE om.status = 'active';

-- 2. Commission dashboard view
CREATE OR REPLACE VIEW commission_dashboard AS
SELECT 
  cc.id,
  cc.organization_id,
  cc.team_member_id,
  tm.full_name as team_member_name,
  tm.email as team_member_email,
  cc.opportunity_id,
  cc.commission_type,
  cc.commission_percentage,
  cc.commission_amount,
  cc.status,
  cc.created_at,
  st.amount as sale_amount,
  st.payment_date,
  st.transaction_type,
  st.contact_id,
  gp.name as product_name,
  cp.payout_number,
  cp.payment_status as payout_status
FROM commission_calculations cc
JOIN sales_transactions st ON cc.transaction_id = st.id
JOIN team_members tm ON cc.team_member_id = tm.id
LEFT JOIN ghl_products gp ON st.product_id = gp.id
LEFT JOIN commission_payouts cp ON cc.payout_id = cp.id;

-- 3. Active integrations view
CREATE OR REPLACE VIEW active_integrations_view AS
SELECT 
  i.id,
  i.organization_id,
  i.type,
  i.name,
  i.is_active,
  i.last_sync_at,
  i.sync_status,
  CASE 
    WHEN i.token_expires_at IS NOT NULL THEN 
      CASE 
        WHEN i.token_expires_at < NOW() THEN 'expired'
        WHEN i.token_expires_at < NOW() + INTERVAL '1 day' THEN 'expiring_soon'
        ELSE 'valid'
      END
    ELSE 'no_expiry'
  END as token_status,
  i.created_at
FROM integrations i
WHERE i.is_active = true;

-- 4. Receipt processing summary view
CREATE OR REPLACE VIEW receipt_processing_summary AS
SELECT 
  rpl.organization_id,
  DATE(rpl.created_at) as processing_date,
  COUNT(*) as total_receipts,
  COUNT(CASE WHEN rpl.processing_status = 'completed' THEN 1 END) as completed,
  COUNT(CASE WHEN rpl.processing_status = 'failed' THEN 1 END) as failed,
  COUNT(CASE WHEN rpl.processing_status = 'manual_review' THEN 1 END) as manual_review,
  COUNT(CASE WHEN rpl.source = 'sms' THEN 1 END) as from_sms,
  COUNT(CASE WHEN rpl.source = 'web_upload' THEN 1 END) as from_web
FROM receipt_processing_log rpl
GROUP BY rpl.organization_id, DATE(rpl.created_at);

-- 5. Team member commission summary view
CREATE OR REPLACE VIEW team_member_commission_summary AS
SELECT 
  tm.id as team_member_id,
  tm.organization_id,
  tm.full_name,
  tm.email,
  COUNT(DISTINCT cc.id) as total_commissions,
  SUM(cc.commission_amount) as total_earned,
  SUM(CASE WHEN cc.status = 'paid' THEN cc.commission_amount ELSE 0 END) as total_paid,
  SUM(CASE WHEN cc.status = 'pending' THEN cc.commission_amount ELSE 0 END) as total_pending,
  MAX(cc.created_at) as last_commission_date
FROM team_members tm
LEFT JOIN commission_calculations cc ON tm.id = cc.team_member_id
GROUP BY tm.id, tm.organization_id, tm.full_name, tm.email;

-- 6. Bot conversation metrics view
CREATE OR REPLACE VIEW bot_conversation_metrics AS
SELECT 
  b.id as bot_id,
  b.organization_id,
  b.name as bot_name,
  COUNT(DISTINCT cs.id) as total_conversations,
  COUNT(DISTINCT cs.contact_id) as unique_contacts,
  COUNT(CASE WHEN cs.status = 'completed' THEN 1 END) as completed_conversations,
  COUNT(CASE WHEN cs.status = 'abandoned' THEN 1 END) as abandoned_conversations,
  AVG(EXTRACT(EPOCH FROM (cs.completed_at - cs.started_at))/60) as avg_conversation_duration_minutes,
  MAX(cs.started_at) as last_conversation_date
FROM bots b
LEFT JOIN conversation_sessions cs ON b.id = cs.bot_id
GROUP BY b.id, b.organization_id, b.name;

-- 7. Calculate commission function
CREATE OR REPLACE FUNCTION calculate_commission_amount(
  p_transaction_id UUID,
  p_team_member_id UUID
)
RETURNS TABLE (
  base_amount DECIMAL,
  commission_amount DECIMAL,
  commission_rate DECIMAL,
  commission_type VARCHAR,
  applied_rule_id UUID
) AS $$
DECLARE
  v_transaction RECORD;
  v_base_amount DECIMAL;
  v_commission_amount DECIMAL;
  v_commission_rate DECIMAL;
  v_commission_type VARCHAR;
  v_applied_rule_id UUID;
BEGIN
  -- Get transaction details
  SELECT * INTO v_transaction
  FROM sales_transactions
  WHERE id = p_transaction_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;
  
  -- First check for specific commission rules
  SELECT 
    cr.commission_value,
    cr.commission_type,
    cr.id
  INTO 
    v_commission_rate,
    v_commission_type,
    v_applied_rule_id
  FROM commission_rules cr
  WHERE cr.organization_id = v_transaction.organization_id
    AND cr.is_active = true
    AND (cr.team_member_ids = '[]'::jsonb OR cr.team_member_ids @> to_jsonb(p_team_member_id::text))
    AND (cr.product_ids = '[]'::jsonb OR cr.product_ids @> to_jsonb(v_transaction.product_id::text))
    AND CURRENT_DATE BETWEEN COALESCE(cr.effective_date, CURRENT_DATE) AND COALESCE(cr.expiry_date, CURRENT_DATE)
  ORDER BY cr.priority DESC
  LIMIT 1;
  
  -- If no specific rule, use team member's default commission structure
  IF v_applied_rule_id IS NULL THEN
    SELECT 
      CASE 
        WHEN v_transaction.transaction_type = 'subscription_initial' THEN cs.subscription_initial_rate
        WHEN v_transaction.transaction_type = 'subscription_renewal' THEN cs.subscription_renewal_rate
        ELSE cs.base_commission_rate
      END,
      cs.commission_type
    INTO 
      v_commission_rate,
      v_commission_type
    FROM commission_structures cs
    WHERE cs.team_member_id = p_team_member_id
      AND cs.is_active = true
      AND CURRENT_DATE BETWEEN COALESCE(cs.effective_date, CURRENT_DATE) AND COALESCE(cs.expiry_date, CURRENT_DATE)
    LIMIT 1;
  END IF;
  
  -- Default to team member's base rate if no structure found
  IF v_commission_rate IS NULL THEN
    SELECT commission_rate, commission_type
    INTO v_commission_rate, v_commission_type
    FROM team_members
    WHERE id = p_team_member_id;
  END IF;
  
  -- Calculate base amount based on commission type
  CASE v_commission_type
    WHEN 'gross' THEN
      v_base_amount := v_transaction.amount;
    WHEN 'profit' THEN
      -- Calculate profit (revenue - expenses from receipts)
      SELECT 
        v_transaction.amount - COALESCE(SUM(receipts.amount), 0)
      INTO v_base_amount
      FROM opportunity_receipts receipts
      WHERE receipts.opportunity_id = v_transaction.opportunity_id
      AND receipts.is_reimbursable = true;
    ELSE
      v_base_amount := v_transaction.amount;
  END CASE;
  
  -- Calculate commission
  IF v_commission_type = 'flat' THEN
    v_commission_amount := v_commission_rate;
  ELSE
    v_commission_amount := v_base_amount * (v_commission_rate / 100);
  END IF;
  
  RETURN QUERY SELECT 
    v_base_amount, 
    v_commission_amount, 
    v_commission_rate,
    v_commission_type,
    v_applied_rule_id;
END;
$$ LANGUAGE plpgsql;

-- 8. Get next workflow node function
CREATE OR REPLACE FUNCTION get_next_workflow_node(
  p_workflow_id UUID,
  p_current_node_id VARCHAR,
  p_condition_data JSONB DEFAULT '{}'
)
RETURNS TABLE (
  next_node_id VARCHAR,
  connection_type VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wc.target_node_id,
    wc.connection_type
  FROM workflow_connections wc
  WHERE wc.workflow_id = p_workflow_id
    AND wc.source_node_id = p_current_node_id
    AND (
      wc.connection_type = 'standard' OR
      (wc.connection_type = 'conditional' AND 
       evaluate_condition(wc.condition, p_condition_data))
    )
  ORDER BY 
    CASE wc.connection_type 
      WHEN 'conditional' THEN 1 
      ELSE 2 
    END
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- 9. Simple condition evaluator (can be expanded)
CREATE OR REPLACE FUNCTION evaluate_condition(
  p_condition JSONB,
  p_data JSONB
)
RETURNS BOOLEAN AS $$
DECLARE
  v_field TEXT;
  v_operator TEXT;
  v_value JSONB;
  v_data_value JSONB;
BEGIN
  -- Simple condition evaluation
  -- Format: {"field": "age", "operator": ">=", "value": 18}
  
  v_field := p_condition->>'field';
  v_operator := p_condition->>'operator';
  v_value := p_condition->'value';
  
  IF v_field IS NULL OR v_operator IS NULL OR v_value IS NULL THEN
    RETURN TRUE; -- No valid condition, default to true
  END IF;
  
  v_data_value := p_data->v_field;
  
  CASE v_operator
    WHEN '=' THEN RETURN v_data_value = v_value;
    WHEN '!=' THEN RETURN v_data_value != v_value;
    WHEN '>' THEN RETURN v_data_value > v_value;
    WHEN '>=' THEN RETURN v_data_value >= v_value;
    WHEN '<' THEN RETURN v_data_value < v_value;
    WHEN '<=' THEN RETURN v_data_value <= v_value;
    WHEN 'contains' THEN RETURN v_data_value::text ILIKE '%' || v_value::text || '%';
    ELSE RETURN TRUE;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- 10. Organization usage update function
CREATE OR REPLACE FUNCTION update_organization_usage()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id UUID;
  v_count INTEGER;
BEGIN
  -- Get organization ID based on table
  CASE TG_TABLE_NAME
    WHEN 'organization_members' THEN v_org_id := NEW.organization_id;
    WHEN 'workflows' THEN v_org_id := NEW.organization_id;
    WHEN 'bots' THEN v_org_id := NEW.organization_id;
    WHEN 'contacts' THEN v_org_id := NEW.organization_id;
    ELSE RETURN NEW;
  END CASE;
  
  -- Update counts based on operation and table
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    CASE TG_TABLE_NAME
      WHEN 'organization_members' THEN
        SELECT COUNT(*) INTO v_count FROM organization_members 
        WHERE organization_id = v_org_id AND status = 'active';
        UPDATE organizations SET current_users = v_count WHERE id = v_org_id;
        
      WHEN 'workflows' THEN
        SELECT COUNT(*) INTO v_count FROM workflows 
        WHERE organization_id = v_org_id AND is_active = true;
        UPDATE organizations SET current_workflows = v_count WHERE id = v_org_id;
        
      WHEN 'bots' THEN
        SELECT COUNT(*) INTO v_count FROM bots 
        WHERE organization_id = v_org_id AND is_active = true;
        UPDATE organizations SET current_bots = v_count WHERE id = v_org_id;
        
      WHEN 'contacts' THEN
        SELECT COUNT(*) INTO v_count FROM contacts 
        WHERE organization_id = v_org_id;
        UPDATE organizations SET current_contacts = v_count WHERE id = v_org_id;
    END CASE;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create usage tracking triggers
CREATE TRIGGER update_org_users_count AFTER INSERT OR UPDATE OR DELETE ON organization_members
  FOR EACH ROW EXECUTE FUNCTION update_organization_usage();

CREATE TRIGGER update_org_workflows_count AFTER INSERT OR UPDATE OR DELETE ON workflows
  FOR EACH ROW EXECUTE FUNCTION update_organization_usage();

CREATE TRIGGER update_org_bots_count AFTER INSERT OR UPDATE OR DELETE ON bots
  FOR EACH ROW EXECUTE FUNCTION update_organization_usage();

CREATE TRIGGER update_org_contacts_count AFTER INSERT OR UPDATE OR DELETE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_organization_usage();

-- Grant permissions on views
GRANT SELECT ON user_organization_view TO authenticated;
GRANT SELECT ON commission_dashboard TO authenticated;
GRANT SELECT ON active_integrations_view TO authenticated;
GRANT SELECT ON receipt_processing_summary TO authenticated;
GRANT SELECT ON team_member_commission_summary TO authenticated;
GRANT SELECT ON bot_conversation_metrics TO authenticated;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION calculate_commission_amount TO authenticated;
GRANT EXECUTE ON FUNCTION get_next_workflow_node TO authenticated;
GRANT EXECUTE ON FUNCTION evaluate_condition TO authenticated;
GRANT EXECUTE ON FUNCTION update_organization_usage TO authenticated;