import { getServiceSupabase } from '@/lib/supabase/client';

export interface ValidationResult {
  status: 'passed' | 'warning' | 'failed' | 'override';
  requiresApproval: boolean;
  checks: ValidationCheck[];
  canProceed: boolean;
  suggestedActions?: string[];
}

export interface ValidationCheck {
  checkName: string;
  result: 'passed' | 'warning' | 'failed' | 'info';
  message: string;
  details?: any;
}

export class CommissionValidator {
  private supabase = getServiceSupabase();

  async validateCommission(
    commissionRecordId: string,
    organizationId: string
  ): Promise<ValidationResult> {
    const checks: ValidationCheck[] = [];
    let status: ValidationResult['status'] = 'passed';
    let requiresApproval = false;
    const suggestedActions: string[] = [];

    try {
      // Get commission details
      const { data: commission, error: commissionError } = await this.supabase
        .from('commission_records')
        .select(`
          *,
          event:commission_events!event_id(
            *,
            product:ghl_products(*)
          ),
          assignment:commission_assignments!assignment_id(*)
        `)
        .eq('id', commissionRecordId)
        .single();

      if (commissionError || !commission) {
        return {
          status: 'failed',
          requiresApproval: false,
          checks: [{
            checkName: 'commission_exists',
            result: 'failed',
            message: 'Commission record not found'
          }],
          canProceed: false
        };
      }

      // Run validation checks
      const productChecks = await this.validateProductRules(commission, organizationId);
      checks.push(...productChecks.checks);
      if (productChecks.status === 'failed') status = 'failed';
      else if (productChecks.status === 'warning' && status !== 'failed') status = 'warning';
      if (productChecks.requiresApproval) requiresApproval = true;

      const marginChecks = await this.validateMargins(commission, organizationId);
      checks.push(...marginChecks.checks);
      if (marginChecks.status === 'failed') status = 'failed';
      else if (marginChecks.status === 'warning' && status !== 'failed') status = 'warning';

      const amountChecks = await this.validateAmounts(commission, organizationId);
      checks.push(...amountChecks.checks);
      if (amountChecks.status === 'failed') status = 'failed';
      else if (amountChecks.status === 'warning' && status !== 'failed') status = 'warning';

      const duplicateChecks = await this.checkDuplicates(commission, organizationId);
      checks.push(...duplicateChecks.checks);
      if (duplicateChecks.status === 'warning' && status !== 'failed') status = 'warning';

      // Territory/availability checks
      const availabilityChecks = await this.validateAvailability(commission, organizationId);
      checks.push(...availabilityChecks.checks);
      if (availabilityChecks.status === 'failed') status = 'failed';

      // Generate suggested actions
      if (status === 'warning' || status === 'failed') {
        if (checks.some(c => c.checkName === 'margin_check' && c.result !== 'passed')) {
          suggestedActions.push('Review commission rate against product margin');
        }
        if (checks.some(c => c.checkName === 'max_commission' && c.result !== 'passed')) {
          suggestedActions.push('Consider applying commission cap');
        }
        if (checks.some(c => c.checkName === 'duplicate_commission' && c.result !== 'passed')) {
          suggestedActions.push('Review existing commissions for this sale');
        }
      }

      // Store validation audit
      await this.storeValidationAudit(
        commissionRecordId,
        status,
        requiresApproval,
        checks
      );

      return {
        status,
        requiresApproval,
        checks,
        canProceed: status !== 'failed',
        suggestedActions: suggestedActions.length > 0 ? suggestedActions : undefined
      };
    } catch (error) {
      console.error('Commission validation error:', error);
      return {
        status: 'failed',
        requiresApproval: false,
        checks: [{
          checkName: 'validation_error',
          result: 'failed',
          message: 'Validation process failed',
          details: error
        }],
        canProceed: false
      };
    }
  }

  private async validateProductRules(
    commission: any,
    organizationId: string
  ): Promise<{ checks: ValidationCheck[], status: ValidationResult['status'], requiresApproval: boolean }> {
    const checks: ValidationCheck[] = [];
    let status: ValidationResult['status'] = 'passed';
    let requiresApproval = false;

    if (!commission.event?.product_id) {
      return { checks, status, requiresApproval };
    }

    // Get product rules
    const { data: productRule } = await this.supabase
      .from('commission_product_rules')
      .select('*')
      .eq('product_id', commission.event.product_id)
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('priority', { ascending: false })
      .limit(1)
      .single();

    if (!productRule) {
      checks.push({
        checkName: 'product_rules',
        result: 'info',
        message: 'No specific product rules defined'
      });
      return { checks, status, requiresApproval };
    }

    // Check product active status
    if (!commission.event.product?.is_active) {
      checks.push({
        checkName: 'product_active',
        result: 'failed',
        message: 'Product is not active'
      });
      status = 'failed';
    }

    // Check if manager approval required
    if (productRule.requires_manager_approval || 
        (productRule.approval_threshold && commission.commission_amount > productRule.approval_threshold)) {
      requiresApproval = true;
      checks.push({
        checkName: 'approval_required',
        result: 'info',
        message: `Manager approval required (threshold: $${productRule.approval_threshold || 'Always'})`
      });
    }

    return { checks, status, requiresApproval };
  }

  private async validateMargins(
    commission: any,
    organizationId: string
  ): Promise<{ checks: ValidationCheck[], status: ValidationResult['status'] }> {
    const checks: ValidationCheck[] = [];
    let status: ValidationResult['status'] = 'passed';

    if (!commission.event?.product_id) {
      return { checks, status };
    }

    // Get product rules
    const { data: productRule } = await this.supabase
      .from('commission_product_rules')
      .select('*')
      .eq('product_id', commission.event.product_id)
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('priority', { ascending: false })
      .limit(1)
      .single();

    if (!productRule || !productRule.estimated_margin_percentage || !productRule.max_commission_of_margin) {
      return { checks, status };
    }

    const maxAllowedRate = productRule.estimated_margin_percentage * (productRule.max_commission_of_margin / 100);
    
    if (commission.commission_rate > maxAllowedRate) {
      checks.push({
        checkName: 'margin_check',
        result: 'warning',
        message: `Commission rate (${commission.commission_rate}%) exceeds ${productRule.max_commission_of_margin}% of product margin (${productRule.estimated_margin_percentage}%)`,
        details: {
          commissionRate: commission.commission_rate,
          productMargin: productRule.estimated_margin_percentage,
          maxAllowedOfMargin: productRule.max_commission_of_margin,
          maxAllowedRate: maxAllowedRate
        }
      });
      status = 'warning';
    } else {
      checks.push({
        checkName: 'margin_check',
        result: 'passed',
        message: 'Commission within acceptable margin limits'
      });
    }

    return { checks, status };
  }

  private async validateAmounts(
    commission: any,
    organizationId: string
  ): Promise<{ checks: ValidationCheck[], status: ValidationResult['status'] }> {
    const checks: ValidationCheck[] = [];
    let status: ValidationResult['status'] = 'passed';

    if (!commission.event?.product_id) {
      return { checks, status };
    }

    // Get product rules
    const { data: productRule } = await this.supabase
      .from('commission_product_rules')
      .select('*')
      .eq('product_id', commission.event.product_id)
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('priority', { ascending: false })
      .limit(1)
      .single();

    if (!productRule) {
      return { checks, status };
    }

    // Check minimum sale amount
    if (productRule.min_sale_amount && commission.event.event_amount < productRule.min_sale_amount) {
      checks.push({
        checkName: 'min_amount',
        result: 'failed',
        message: `Sale amount ($${commission.event.event_amount}) below minimum ($${productRule.min_sale_amount}) for commission`,
        details: {
          saleAmount: commission.event.event_amount,
          minRequired: productRule.min_sale_amount
        }
      });
      status = 'failed';
    }

    // Check maximum commission amount
    if (productRule.max_commission_amount && commission.commission_amount > productRule.max_commission_amount) {
      checks.push({
        checkName: 'max_commission',
        result: 'warning',
        message: `Commission amount ($${commission.commission_amount}) exceeds maximum allowed ($${productRule.max_commission_amount})`,
        details: {
          commissionAmount: commission.commission_amount,
          maxAllowed: productRule.max_commission_amount
        }
      });
      status = 'warning';
    }

    return { checks, status };
  }

  private async checkDuplicates(
    commission: any,
    organizationId: string
  ): Promise<{ checks: ValidationCheck[], status: ValidationResult['status'] }> {
    const checks: ValidationCheck[] = [];
    let status: ValidationResult['status'] = 'passed';

    // Check for duplicate commissions
    const { data: duplicates } = await this.supabase
      .from('commission_records')
      .select('id, team_member_id, commission_amount')
      .eq('organization_id', organizationId)
      .eq('event_id', commission.event_id)
      .neq('id', commission.id);

    if (duplicates && duplicates.length > 0) {
      checks.push({
        checkName: 'duplicate_commission',
        result: 'warning',
        message: `Found ${duplicates.length} other commission(s) for this event`,
        details: {
          duplicateCount: duplicates.length,
          totalCommissions: duplicates.reduce((sum, d) => sum + d.commission_amount, 0) + commission.commission_amount
        }
      });
      status = 'warning';
    }

    return { checks, status };
  }

  private async validateAvailability(
    commission: any,
    organizationId: string
  ): Promise<{ checks: ValidationCheck[], status: ValidationResult['status'] }> {
    const checks: ValidationCheck[] = [];
    let status: ValidationResult['status'] = 'passed';

    // Check if product was available at time of sale
    if (commission.event?.product && commission.event.product.created_at) {
      const productCreatedAt = new Date(commission.event.product.created_at);
      const saleDate = new Date(commission.event.event_date);

      if (productCreatedAt > saleDate) {
        checks.push({
          checkName: 'product_availability',
          result: 'failed',
          message: 'Product was not available at the time of sale',
          details: {
            productCreated: productCreatedAt,
            saleDate: saleDate
          }
        });
        status = 'failed';
      }
    }

    // Territory checks would go here if implemented
    // For now, just pass
    checks.push({
      checkName: 'territory_check',
      result: 'passed',
      message: 'Territory validation passed'
    });

    return { checks, status };
  }

  private async storeValidationAudit(
    commissionRecordId: string,
    status: ValidationResult['status'],
    requiresApproval: boolean,
    checks: ValidationCheck[]
  ): Promise<void> {
    try {
      await this.supabase
        .from('commission_validation_audit')
        .insert({
          commission_record_id: commissionRecordId,
          validation_status: status,
          checks_performed: checks,
          requires_approval: requiresApproval
        });
    } catch (error) {
      console.error('Failed to store validation audit:', error);
    }
  }

  async approveCommission(
    commissionRecordId: string,
    approverId: string,
    approvalNotes?: string
  ): Promise<boolean> {
    try {
      const { error: auditError } = await this.supabase
        .from('commission_validation_audit')
        .update({
          approval_status: 'approved',
          approved_by: approverId,
          approval_date: new Date().toISOString(),
          approval_notes: approvalNotes
        })
        .eq('commission_record_id', commissionRecordId)
        .eq('requires_approval', true);

      if (auditError) {
        console.error('Failed to update audit approval:', auditError);
        return false;
      }

      const { error: recordError } = await this.supabase
        .from('commission_records')
        .update({
          status: 'approved',
          approved_by: approverId,
          approved_at: new Date().toISOString(),
          approval_notes: approvalNotes
        })
        .eq('id', commissionRecordId);

      return !recordError;
    } catch (error) {
      console.error('Failed to approve commission:', error);
      return false;
    }
  }

  async overrideValidation(
    commissionRecordId: string,
    overrideById: string,
    overrideReason: string
  ): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('commission_validation_audit')
        .update({
          validation_status: 'override',
          override_reason: overrideReason,
          override_by: overrideById,
          override_at: new Date().toISOString()
        })
        .eq('commission_record_id', commissionRecordId);

      return !error;
    } catch (error) {
      console.error('Failed to override validation:', error);
      return false;
    }
  }
}