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