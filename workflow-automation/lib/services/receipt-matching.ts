import { getServiceSupabase } from '@/lib/auth/production-auth-server';
import OpenAI from 'openai';

export interface ReceiptData {
  vendor_name: string;
  amount: number;
  receipt_date: string;
  description?: string;
  receipt_number?: string;
  category: string;
  confidence: number;
}

export interface JobMatch {
  opportunityId: string;
  opportunityName: string;
  contactName: string;
  confidence: number;
  reason: string;
}

export async function findMatchingJobs(
  organizationId: string, 
  receiptData: ReceiptData, 
  apiKey: string,
  contactPhone?: string
): Promise<JobMatch[]> {
  const supabase = getServiceSupabase();
  
  try {
    // Check if this phone number belongs to a team member
    let filterGhlUserId: string | null = null;
    
    if (contactPhone) {
      const { data: teamMember } = await supabase
        .from('team_members')
        .select('ghl_user_id')
        .eq('organization_id', organizationId)
        .eq('phone', contactPhone)
        .single();
      
      if (teamMember && teamMember.ghl_user_id) {
        filterGhlUserId = teamMember.ghl_user_id;
        console.log('Found GHL user ID from phone:', filterGhlUserId);
      } else {
        // Not an internal team member - don't process
        console.log('Phone number not associated with any team member');
        return [];
      }
    }

    // Step 1: Get all pipeline stages from opportunities
    let query = supabase
      .from('opportunity_cache')
      .select('stage')
      .eq('organization_id', organizationId)
      .eq('status', 'open');
    
    // Filter by assigned user (required for internal functions)
    if (filterGhlUserId) {
      query = query.eq('assigned_to', filterGhlUserId);
      console.log('Filtering opportunities by assigned GHL user:', filterGhlUserId);
    }

    const { data: stageData } = await query;

    const uniqueStages = [...new Set(stageData?.map(s => s.stage) || [])];
    console.log('Available pipeline stages:', uniqueStages);

    // Step 2: Use AI to identify active job stages
    const activeStages = await identifyActiveJobStages(uniqueStages, receiptData.category, apiKey);
    console.log('AI identified active stages:', activeStages);

    // Step 3: Get opportunities from active stages
    let oppQuery = supabase
      .from('opportunity_cache')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('status', 'open')
      .in('stage', activeStages.length > 0 ? activeStages : uniqueStages);
    
    // Filter by assigned user (required for internal functions)
    if (filterGhlUserId) {
      oppQuery = oppQuery.eq('assigned_to', filterGhlUserId);
    }

    const { data: opportunities } = await oppQuery;

    if (!opportunities || opportunities.length === 0) {
      return [];
    }

    console.log(`Found ${opportunities.length} opportunities in active stages`);

    // Step 4: Use AI to rank and match opportunities
    const matches = await aiRankOpportunities(opportunities, receiptData, apiKey);
    
    // Return top 5 matches
    return matches.slice(0, 5);

  } catch (error) {
    console.error('Error finding matching jobs:', error);
    return [];
  }
}

export async function findCompletedJobMatches(
  organizationId: string, 
  receiptData: ReceiptData, 
  apiKey: string,
  contactPhone?: string
): Promise<JobMatch[]> {
  const supabase = getServiceSupabase();
  
  try {
    // Check if this phone number belongs to a team member
    let filterGhlUserId: string | null = null;
    
    if (contactPhone) {
      const { data: teamMember } = await supabase
        .from('team_members')
        .select('ghl_user_id')
        .eq('organization_id', organizationId)
        .eq('phone', contactPhone)
        .single();
      
      if (teamMember && teamMember.ghl_user_id) {
        filterGhlUserId = teamMember.ghl_user_id;
        console.log('Found GHL user ID from phone:', filterGhlUserId);
      } else {
        // Not an internal team member - don't process
        console.log('Phone number not associated with any team member');
        return [];
      }
    }

    // Get all pipeline stages from opportunities assigned to this GHL user
    let query = supabase
      .from('opportunity_cache')
      .select('stage')
      .eq('organization_id', organizationId);
    
    // Filter by assigned user (required for internal functions)
    if (filterGhlUserId) {
      query = query.eq('assigned_to', filterGhlUserId);
      console.log('Filtering completed opportunities by assigned GHL user:', filterGhlUserId);
    }

    const { data: stageData } = await query;

    const uniqueStages = [...new Set(stageData?.map(s => s.stage) || [])];
    
    // Use AI to identify completed job stages
    const completedStages = await identifyCompletedJobStages(uniqueStages, apiKey);
    console.log('AI identified completed stages:', completedStages);

    if (completedStages.length === 0) return [];

    // Get opportunities from completed stages
    let oppQuery = supabase
      .from('opportunity_cache')
      .select('*')
      .eq('organization_id', organizationId)
      .in('stage', completedStages)
      .order('ghl_updated_at', { ascending: false })
      .limit(20); // Recent completed jobs
    
    // Filter by assigned user (required for internal functions)
    if (filterGhlUserId) {
      oppQuery = oppQuery.eq('assigned_to', filterGhlUserId);
    }

    const { data: opportunities } = await oppQuery;

    if (!opportunities || opportunities.length === 0) return [];

    // Use AI to rank completed opportunities
    return await aiRankOpportunities(opportunities, receiptData, apiKey);
  } catch (error) {
    console.error('Error finding completed job matches:', error);
    return [];
  }
}

async function identifyActiveJobStages(stages: string[], receiptCategory: string, apiKey: string): Promise<string[]> {
  if (stages.length === 0) return [];

  const openai = new OpenAI({ apiKey });
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{
        role: "user",
        content: `Given these pipeline stage names from a contractor/service business CRM:
${stages.join(', ')}

And a receipt for: ${receiptCategory}

Identify which stages likely represent ACTIVE jobs where work is being performed and materials/expenses would be incurred.
Return ONLY a JSON array of the relevant stage names. For example: ["In Progress", "Scheduled", "Active Work"]

Consider that receipts for ${receiptCategory} would typically be associated with jobs that are actively being worked on, not leads or completed jobs.`
      }],
      max_tokens: 200,
      temperature: 0.3
    });

    const content = response.choices[0]?.message?.content || '[]';
    const activeStages = JSON.parse(content);
    return Array.isArray(activeStages) ? activeStages : [];
  } catch (error) {
    console.error('Error identifying active stages:', error);
    return stages; // Fallback to all stages
  }
}

async function identifyCompletedJobStages(stages: string[], apiKey: string): Promise<string[]> {
  if (stages.length === 0) return [];

  const openai = new OpenAI({ apiKey });
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{
        role: "user",
        content: `Given these pipeline stage names from a contractor/service business CRM:
${stages.join(', ')}

Identify which stages likely represent COMPLETED or RECENTLY COMPLETED jobs where final expenses might still be submitted.
Return ONLY a JSON array of the relevant stage names. For example: ["Complete", "Finished", "Paid"]

Consider stages that indicate work is done but paperwork/expenses might still be pending.`
      }],
      max_tokens: 200,
      temperature: 0.3
    });

    const content = response.choices[0]?.message?.content || '[]';
    const completedStages = JSON.parse(content);
    return Array.isArray(completedStages) ? completedStages : [];
  } catch (error) {
    console.error('Error identifying completed stages:', error);
    return [];
  }
}

async function aiRankOpportunities(opportunities: any[], receiptData: ReceiptData, apiKey: string): Promise<JobMatch[]> {
  const openai = new OpenAI({ apiKey });
  
  // Prepare opportunity summaries
  const oppSummaries = opportunities.map((opp, idx) => ({
    index: idx,
    name: opp.title,
    contact: opp.contact_name,
    stage: opp.stage,
    value: opp.monetary_value,
    lastUpdate: opp.ghl_updated_at
  }));

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{
        role: "user",
        content: `Match this receipt to the most relevant jobs:

Receipt Details:
- Vendor: ${receiptData.vendor_name}
- Amount: $${receiptData.amount}
- Date: ${receiptData.receipt_date}
- Category: ${receiptData.category}
- Description: ${receiptData.description || 'N/A'}

Available Jobs:
${oppSummaries.map(opp => `
${opp.index}. "${opp.name}" - ${opp.contact}
   Stage: ${opp.stage}
   Value: $${opp.value}
   Last Updated: ${opp.lastUpdate}
`).join('')}

Return a JSON array of the top matches with confidence scores (0-100) and reasoning.
Format: [{"index": 0, "confidence": 85, "reason": "Materials receipt likely for this active construction job"}]
Only include matches with confidence > 40. Maximum 5 matches.`
      }],
      max_tokens: 500,
      temperature: 0.3
    });

    const content = response.choices[0]?.message?.content || '[]';
    const aiMatches = JSON.parse(content);
    
    return aiMatches.map((match: any) => {
      const opp = opportunities[match.index];
      return {
        opportunityId: opp.opportunity_id,
        opportunityName: opp.title,
        contactName: opp.contact_name,
        confidence: Math.min(100, Math.max(0, match.confidence)),
        reason: match.reason || 'AI matched based on context'
      };
    });
  } catch (error) {
    console.error('Error in AI ranking:', error);
    // Fallback to simple matching
    return simpleFallbackMatching(opportunities, receiptData);
  }
}

function simpleFallbackMatching(opportunities: any[], receiptData: ReceiptData): JobMatch[] {
  const matches: JobMatch[] = [];

  for (const opp of opportunities) {
    let confidence = 50; // Base confidence for being in active stage
    const reasons: string[] = ['In active job stage'];

    // Add some basic matching logic
    if (receiptData.vendor_name && opp.title) {
      const similarity = calculateStringSimilarity(
        receiptData.vendor_name.toLowerCase(),
        opp.title.toLowerCase()
      );
      if (similarity > 0.3) {
        confidence += similarity * 30;
        reasons.push('Name similarity');
      }
    }

    matches.push({
      opportunityId: opp.opportunity_id,
      opportunityName: opp.title,
      contactName: opp.contact_name,
      confidence: Math.round(confidence),
      reason: reasons.join(', ')
    });
  }

  return matches.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
}

function calculateStringSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = getEditDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function getEditDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }
  
  return matrix[str2.length][str1.length];
}