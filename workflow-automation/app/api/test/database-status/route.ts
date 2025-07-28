import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    console.log('Checking database setup status...');
    
    const results = {
      status: 'checking',
      tables: {},
      requiredTables: [
        'integrations',
        'synced_contacts', 
        'contact_sync_jobs',
        'incoming_messages',
        'opportunity_receipts',
        'opportunity_cache',
        'receipt_processing_log',
        'user_api_keys'
      ],
      missingTables: [],
      issues: [],
      recommendations: []
    };
    
    // Check each required table
    for (const tableName of results.requiredTables) {
      try {
        const { data, error, count } = await supabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });
        
        if (error) {
          results.tables[tableName] = {
            exists: false,
            error: error.message,
            rowCount: 0
          };
          results.missingTables.push(tableName);
        } else {
          results.tables[tableName] = {
            exists: true,
            rowCount: count || 0,
            error: null
          };
        }
      } catch (tableError: any) {
        results.tables[tableName] = {
          exists: false,
          error: tableError.message,
          rowCount: 0
        };
        results.missingTables.push(tableName);
      }
    }
    
    // Check specific fields in receipt_processing_log
    if (results.tables['receipt_processing_log']?.exists) {
      try {
        const { data: columns } = await supabase.rpc('get_table_columns', {
          table_name: 'receipt_processing_log'
        });
        
        const requiredColumns = [
          'phone_number', 'attachment_url', 'processing_status', 
          'message_id', 'attachment_id', 'extracted_data',
          'response_message', 'response_sent'
        ];
        
        const missingColumns = [];
        for (const col of requiredColumns) {
          if (!columns?.some((c: any) => c.column_name === col)) {
            missingColumns.push(col);
          }
        }
        
        if (missingColumns.length > 0) {
          results.issues.push({
            table: 'receipt_processing_log',
            issue: 'Missing required columns for message processing',
            missingColumns,
            fix: 'Run the message processing fields migration'
          });
        }
      } catch (columnError) {
        // Fallback: try a simple query to check if message fields exist
        try {
          await supabase
            .from('receipt_processing_log')
            .select('phone_number, processing_status, message_id')
            .limit(1);
        } catch (fieldError: any) {
          results.issues.push({
            table: 'receipt_processing_log',
            issue: 'Message processing fields missing',
            error: fieldError.message,
            fix: 'Run: 20250126_update_receipt_processing_for_messages.sql'
          });
        }
      }
    }
    
    // Check for active GHL integrations
    if (results.tables['integrations']?.exists) {
      try {
        const { data: integrations, error } = await supabase
          .from('integrations')
          .select('id, type, status, config')
          .eq('type', 'gohighlevel')
          .eq('status', 'active');
        
        if (error) {
          results.issues.push({
            table: 'integrations',
            issue: 'Cannot check GHL integrations',
            error: error.message
          });
        } else {
          results.tables['integrations'].ghlIntegrations = integrations?.length || 0;
          
          if (!integrations || integrations.length === 0) {
            results.recommendations.push('Connect a GoHighLevel integration to enable SMS receipt processing');
          }
        }
      } catch (integrationError: any) {
        results.issues.push({
          table: 'integrations',
          issue: 'Error checking GHL integrations',
          error: integrationError.message
        });
      }
    }
    
    // Check synced contacts
    if (results.tables['synced_contacts']?.exists) {
      try {
        const { count } = await supabase
          .from('synced_contacts')
          .select('*', { count: 'exact', head: true });
        
        results.tables['synced_contacts'].contactCount = count || 0;
        
        if (!count || count === 0) {
          results.recommendations.push('Sync contacts from GHL to enable phone number lookup for incoming messages');
        }
      } catch (contactError) {
        // Non-critical error
      }
    }
    
    // Determine overall status
    if (results.missingTables.length === 0 && results.issues.length === 0) {
      results.status = 'ready';
    } else if (results.missingTables.length > 0) {
      results.status = 'missing_tables';
    } else {
      results.status = 'needs_fixes';
    }
    
    return NextResponse.json(results);
    
  } catch (error: any) {
    console.error('Error checking database status:', error);
    return NextResponse.json({ 
      status: 'error',
      error: error.message,
      details: 'Failed to check database status'
    }, { status: 500 });
  }
}