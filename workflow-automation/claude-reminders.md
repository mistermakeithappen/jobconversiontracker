# Claude Reminders - Project Learning Log

## Database Issues

### Time Entries Foreign Key Constraint
**Problem**: Time entries table has foreign key constraint on user_id that references auth.users, but we're using GoHighLevel user IDs which don't exist in auth.users table.

**Solution**: Remove foreign key constraint and allow time_entries.user_id to store GoHighLevel user IDs as strings.

**Error**: `insert or update on table 'time_entries' violates foreign key constraint 'time_entries_user_id_fkey'`

### Payment Structure Column Issues
**Problem**: Database schema cache issues when columns don't exist (ghl_user_email, ghl_user_phone)

**Solution**: Always run migrations to add missing columns and verify schema matches API expectations.

## API Validation
**Problem**: Frontend form validation must match backend API validation exactly.

**Solution**: When making fields optional in frontend, also update backend validation accordingly.

## GoHighLevel Integration
**Issue**: GoHighLevel user IDs are strings, not UUIDs. Database constraints assuming UUID foreign keys will fail.

**Solution**: Use VARCHAR fields for GHL user IDs and avoid foreign key constraints to auth.users table.

## Commission System Unification
**Problem**: Sales and Opportunities modules had disconnected commission tracking systems.

**Solution**: Created unified commission system:
1. **commission_rules** table for global commission configuration
2. Synced with real GHL users via `/api/integrations/automake/users` endpoint
3. Support for both one-off and MRR commissions with different payment models:
   - All recurring payments
   - First payment only
   - Duration-based (e.g., 12 months)
   - Trailing commissions (e.g., 3 months after initial sale)
4. Created `/api/commissions/rules` API for CRUD operations
5. Updated UI to fetch real GHL users

**Migration**: `20250301_commission_rules_system.sql`

## AI Receipt Processing Integration
**Issue**: AI receipt processing was built but not connected to the new AI entry interface.

**Solution**: Connect existing `/api/receipts/process-image` API to the AI upload form by:
1. Creating `processReceiptWithAI()` function that sends FormData to the API
2. Pre-filling manual form with AI-extracted data (vendor_name, amount, date, etc.)
3. Adding loading states and proper error handling
4. Switching from AI form to pre-filled manual form for review

**API Endpoint**: `/api/receipts/process-image` - accepts FormData with file, opportunityId, integrationId

## Comprehensive File Conversion System
**Need**: Convert all incoming receipt files (user uploads + SMS attachments) to PNG before OpenAI processing for consistency and optimal results.

**Solution**: Created `FileConverter` utility class that:
1. **Validates files**: Size limit (10MB), supported formats (JPEG, PNG, WebP, TIFF, HEIC, PDF)
2. **Converts to PNG**: Optimized for OpenAI Vision API (max 2048x2048, quality 90)
3. **Handles all formats**: 
   - Standard images → Sharp processing
   - HEIC/HEIF (iPhone) → Sharp native support  
   - PDF receipts → pdf2pic conversion (first page only)
4. **Creates data URLs**: Proper base64 encoding for OpenAI API

**Updated APIs**:
- `/api/receipts/process-image` - User uploads
- `/api/receipts/process-from-message` - SMS attachments

**Dependencies Required**:
```bash
npm install sharp pdf2pic
npm install --save-dev @types/sharp
```

## GoHighLevel MCP Integration (CRITICAL LEARNINGS)

### Request Format MUST BE JSON-RPC 2.0
**Problem**: Initial implementation tried simple `{"tool": "...", "input": "..."}` format but server expects full JSON-RPC.

**Correct Format**:
```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "contacts_get-contacts",
    "arguments": { "limit": 5 }
  },
  "id": 1234567890
}
```

### Server-Sent Events (SSE) Response Handling
**Problem**: Server returns `text/event-stream` NOT `application/json`, causing "Unexpected token 'e'" errors.

**Solution**: Must handle SSE format:
```
event: message
data: {"jsonrpc":"2.0","result":[...],"id":123}

event: done
data: [DONE]
```

**Implementation**: Use ReadableStream to read chunks, extract JSON from `data: ` lines.

### Required Headers for 406 Error Fix
**Problem**: Server returns 406 Not Acceptable without proper headers.

**Required Headers**:
```
Content-Type: application/json
Accept: application/json, text/event-stream
Authorization: Bearer <PIT_TOKEN>
locationId: <LOCATION_ID>
```

### Correct Tool Names (21 Official Tools)
**Problem**: Documentation sometimes shows inconsistent naming.

**Verified Working Tools**:
- Calendar: `calendars_get-calendar-events`, `calendars_get-appointment-notes`
- Contacts: `contacts_get-contacts` (NOT `contacts_list-contacts`)
- Opportunities: `opportunities_search-opportunity` (NOT `opportunities_get-opportunities`)
- Payments: `payments_get-order-by-id`, `payments_list-transactions`

### MCP Client Implementation Key Points
1. **Content-Type Detection**: Check for `text/event-stream` vs `application/json`
2. **Stream Processing**: Use `response.body.getReader()` for SSE parsing
3. **Error Extraction**: Handle both JSON-RPC errors and SSE stream errors
4. **Result Extraction**: Return `data.result` from JSON-RPC response

### Testing Infrastructure
**Location**: `/chatbot` page with comprehensive MCP testing interface
**Features**: 
- Connection verification
- All 21 tools with categorized buttons
- Real-time error display with detailed messages
- Success confirmation with data preview

### All 21 Official MCP Tools Implemented (July 29, 2025)
**Problem**: We were missing some tools and had incorrect tool names/organization.

**Solution**: Implemented all 21 official GoHighLevel MCP tools with correct API identifiers:

**📅 Calendar (2 tools):**
- `calendars_get-calendar-events`
- `calendars_get-appointment-notes`

**👥 Contacts (8 tools):**
- `contacts_get-contacts`
- `contacts_get-contact` 
- `contacts_create-contact`
- `contacts_update-contact`
- `contacts_upsert-contact`
- `contacts_add-tags`
- `contacts_remove-tags`
- `contacts_get-all-tasks`

**💬 Conversations (3 tools):**
- `conversations_search-conversation`
- `conversations_get-messages`
- `conversations_send-a-new-message`

**🎯 Opportunities (4 tools):**
- `opportunities_search-opportunity`
- `opportunities_get-pipelines`
- `opportunities_get-opportunity`
- `opportunities_update-opportunity`

**📍 Locations (2 tools):**
- `locations_get-location`
- `locations_get-custom-fields`

**💳 Payments (2 tools):**
- `payments_get-order-by-id`
- `payments_list-transactions`

**Note**: There is no separate "getTags", "getUsers", or "getWorkflows" in the official 21 tools. For tag management, use the contacts_add-tags and contacts_remove-tags tools.

### AI-Powered Chatbot Integration (July 29, 2025)
**Problem**: Chatbot was using hardcoded responses instead of actually leveraging AI to perform tasks.

**Solution**: Integrated OpenAI GPT-4 with function calling to make the chatbot truly intelligent:

**Features Added**:
- **OpenAI Integration**: Uses user's OpenAI API key from database
- **Function Calling**: AI can call MCP tools directly (get_contacts, search_opportunities, etc.)
- **Real Data Access**: Actually retrieves and uses real GoHighLevel data
- **Intelligent Responses**: AI understands context and provides specific guidance
- **Dynamic Actions**: Can perform actual tasks like creating contacts, adding tags, etc.

**How It Works**:
1. User sends message to chatbot
2. AI determines if MCP tools are needed
3. Calls appropriate GoHighLevel MCP functions
4. Returns intelligent response with real data and actionable guidance

**Requirements**: User must have both GoHighLevel MCP enabled AND OpenAI API key configured

**Files Updated**:
- `/app/api/chatbot/chat/route.ts` - Complete AI integration with function calling
- System now uses GPT-4 with 6 main MCP functions for real GoHighLevel operations

### Message Sending via MCP (July 29, 2025)
**Problem**: Chatbot needed ability to send messages (SMS/Email) to contacts through GoHighLevel MCP.

**Solution**: Implemented message sending functionality using the official MCP tool:

**Implementation Details**:
1. **Tool Used**: `conversations_send-a-new-message` from official 21 MCP tools
2. **Workflow**: 
   - First find contact using `get_contacts` to get contact ID
   - Search for existing conversation or use contact ID as conversation ID
   - Send message via `sendMessage` method with type (SMS/Email)
3. **AI Integration**: GPT-4 composes appropriate messages based on user requests

**Features**:
- Professional message composition by AI
- Support for both SMS and Email (defaults to SMS)
- Context-aware messages (e.g., scheduling requests include flexibility)
- Automatic conversation lookup/creation

**Example Usage**: "Send Brandon a message asking him to schedule an estimate"
- AI finds Brandon's contact ID
- Composes professional message: "Hi Brandon, I hope this message finds you well. Would you be available to schedule an estimate? Please let me know some times that work for you."
- Sends via SMS through MCP

**Files Updated**:
- `/app/api/chatbot/chat/route.ts` - Added send_message function and workflow
- `/lib/mcp/ghl-mcp-client.ts` - Updated sendMessage to include contactId parameter

**Issue Fixed (July 29, 2025)**: 
- **Problem**: "Contact id not given" error when sending messages
- **Root Cause**: GoHighLevel MCP tools use specific parameter naming with prefixes (body_, path_, query_)
- **Solution**: For `conversations_send-a-new-message`, use:
  - `body_type` instead of `type`
  - `body_contactId` instead of `contactId`  
  - `body_message` instead of `message`
- **Fix**: Updated chatbot to use correct parameter names when calling MCP tools
- **Result**: Messages now send successfully with status 201

### GoHighLevel MCP Parameter Naming Convention (CRITICAL)
**Problem**: MCP tools fail with errors like "Contact id not given" even when parameters are provided.

**Root Cause**: GoHighLevel MCP uses OpenAPI-style parameter naming where each parameter must be prefixed based on its location in the HTTP request:
- `body_` prefix for request body parameters
- `path_` prefix for URL path parameters
- `query_` prefix for URL query parameters

**Examples**:
1. **conversations_send-a-new-message**:
   - ❌ Wrong: `{ contactId, message, type }`
   - ✅ Correct: `{ body_contactId, body_message, body_type }`

2. **contacts_get-contact**:
   - ❌ Wrong: `{ contactId }`
   - ✅ Correct: `{ path_contactId }`

3. **calendars_get-calendar-events**:
   - ❌ Wrong: `{ startTime, endTime, userId }`
   - ✅ Correct: `{ query_startTime, query_endTime, query_userId }`

**How to Determine Correct Prefixes**:
1. List all tools: Call `tools/list` method to get tool schemas
2. Check `inputSchema` for each tool - parameter names show the prefix
3. Parameter descriptions also indicate location: "[Body]", "[path]", "[query]"

**Implementation Pattern**:
```typescript
// Instead of using generic parameters:
client.sendMessage(conversationId, message, type);

// Call the tool directly with prefixed parameters:
client.callTool('conversations_send-a-new-message', {
  body_type: 'SMS',
  body_contactId: contactId,
  body_message: message
});
```

**Debugging Tip**: When getting parameter errors, always check the tool schema first to ensure correct parameter naming!

### Calendar Events Parameter Fix (July 29, 2025)
**Problem**: "What appointments does brandon burgan have?" returned error due to incorrect parameter naming.

**Root Cause**: `calendars_get-calendar-events` requires:
1. All parameters must use `query_` prefix
2. Parameter names are `startTime`/`endTime`, not `startDate`/`endDate`
3. Requires either `userId`, `calendarId`, or `groupId` to be provided

**Solution**: Use correct parameter names with prefixes:
```typescript
// ❌ Wrong:
client.getCalendarEvents({ startDate, endDate, userId })

// ✅ Correct:
client.callTool('calendars_get-calendar-events', {
  query_startTime: startTime,
  query_endTime: endTime,
  query_userId: userId
})
```

**Note**: GoHighLevel calendar events don't directly filter by contact ID. You need to:
1. Use the contact's associated user ID if they have one
2. Or get all events and filter client-side
3. Or use a different approach to find contact-specific appointments

**Implementation**: Updated chatbot to:
1. Use correct `query_` prefixed parameters for calendar events
2. Handle the API limitation gracefully with transparent error messages
3. Explain to users that contact-specific appointment filtering isn't supported by the API
4. Suggest using the web interface for contact-specific appointments

## GoHighLevel API Scopes Requirements (CRITICAL - July 31, 2025)

**Problem**: Getting 401 "The token is not authorized for this scope" errors when trying to access certain GHL endpoints like `/calendars`.

**Root Cause**: Each GoHighLevel API endpoint requires specific OAuth scopes. If the scope wasn't included during initial OAuth connection, the token won't have permission to access that endpoint.

### Required Scopes for Workflow Features:
- `contacts.readonly` `contacts.write` - For contact management
- `opportunities.readonly` `opportunities.write` - For opportunity/pipeline management  
- `locations.readonly` - For location data
- `conversations.readonly` `conversations.write` - For messaging
- `users.readonly` - For user data
- `products.readonly` - For product catalog
- `invoices.readonly` - For invoice data
- `payments/subscriptions.readonly` - For payment data
- **`calendars.readonly` `calendars.write`** - For calendar and appointment management (REQUIRED for `/calendars` endpoint)
- **`tags.readonly` `tags.write`** - For tag management
- **`custom-fields.readonly` `custom-fields.write`** - For custom field management

### Common Scope-Related Issues:
1. **401 "The token is not authorized for this scope"** - Token doesn't have required scope
2. **Solution**: User must disconnect and reconnect GHL to get new permissions
3. **Prevention**: Always check and add required scopes BEFORE implementing new features

### How to Add New GHL Features:
1. Check what API endpoint the feature uses
2. Look up required scope in GHL API docs
3. Add scope to `lib/integrations/gohighlevel/config.ts`
4. Notify user they need to reconnect GHL to get new permissions

### Note on Endpoint vs MCP:
- **For workflow builder features**: Use direct GHL v2 API endpoints (like `/calendars`, `/tags`)
- **For chatbot features**: Can use MCP tools which have different auth mechanism
- **Don't mix them**: MCP is for chatbot, direct API is for workflows