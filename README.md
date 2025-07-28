# Make.com Replicate Software

## Project Setup

This project is configured with:

### 1. Supabase Integration
- **Regular Client** (`supabase.js`) - For client-safe operations with RLS
- **Admin Client** (`supabase-admin.js`) - For backend admin operations
- Project Reference: `hmulhwnftlsezkjuflxm`

### 2. REF MCP Integration
- Ensures up-to-date code and documentation references
- Prevents AI hallucinations by accessing current API documentation
- API Key: `ref-2d993b8896ac2f8a93a8`

## Environment Variables

Create a `.env` file with:
```
SUPABASE_URL=https://hmulhwnftlsezkjuflxm.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key
```

## MCP Configuration

Both REF and Supabase MCP servers are configured in `claude_config.json` for use with Claude Desktop.

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Test Supabase connection:
   ```bash
   node test-connection.js
   ```

3. Run admin examples:
   ```bash
   node admin-examples.js
   ```

## Important Notes

- **Never expose** the service key or admin client to client-side code
- REF MCP is automatically used when Claude Desktop is running
- Always use REF when integrating with external APIs or SDKs