import { NextRequest, NextResponse } from 'next/server';
import { INTEGRATION_REGISTRY, getIntegrationById, getIntegrationsByCategory, getActiveIntegrations, getAllEndpoints, searchEndpoints } from '@/lib/integrations/registry';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const integrationId = searchParams.get('id');
    const category = searchParams.get('category');
    const activeOnly = searchParams.get('active') === 'true';
    const endpoints = searchParams.get('endpoints') === 'true';
    const search = searchParams.get('search');

    // Search endpoints
    if (search) {
      const results = searchEndpoints(search);
      return NextResponse.json({
        results,
        total: results.length,
        query: search
      });
    }

    // Get all endpoints
    if (endpoints) {
      const allEndpoints = getAllEndpoints();
      return NextResponse.json({
        endpoints: allEndpoints,
        total: allEndpoints.length
      });
    }

    // Get specific integration
    if (integrationId) {
      const integration = getIntegrationById(integrationId);
      if (!integration) {
        return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
      }
      return NextResponse.json({ integration });
    }

    // Get integrations by category
    if (category) {
      const integrations = getIntegrationsByCategory(category as any);
      return NextResponse.json({
        integrations,
        total: integrations.length,
        category
      });
    }

    // Get active integrations only
    if (activeOnly) {
      const integrations = getActiveIntegrations();
      return NextResponse.json({
        integrations,
        total: integrations.length
      });
    }

    // Get all integrations
    return NextResponse.json({
      integrations: INTEGRATION_REGISTRY,
      total: INTEGRATION_REGISTRY.length,
      categories: [...new Set(INTEGRATION_REGISTRY.map(i => i.category))],
      statuses: [...new Set(INTEGRATION_REGISTRY.map(i => i.status))]
    });

  } catch (error) {
    console.error('Error in integrations registry:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}