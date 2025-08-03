# Contact Sync Migration Instructions

## Steps to Enable Contact Sync:

### 1. Run the Database Migration

Go to the Supabase SQL Editor:
https://supabase.com/dashboard/project/hmulhwnftlsezkjuflxm/sql/new

Copy and paste the migration from:
`/workflow-automation/supabase/migrations/20250730_ghl_contacts_sync.sql`

Click "Run" to execute it.

### 2. Verify Tables Were Created

Run this query to check:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('ghl_contacts', 'ghl_contact_sync_logs');
```

You should see both tables listed.

### 3. Start Initial Sync

Once tables are created, go to the Contacts page and click "Sync Contacts". This will:
- Import all 5000+ contacts from GoHighLevel to the database
- Run in the background without freezing your browser
- Show progress updates on the page

### 4. Set Up Webhooks (Optional)

To keep contacts automatically synced, add this webhook URL in GoHighLevel:
```
https://your-domain.vercel.app/api/webhooks/ghl/contacts
```

Subscribe to these events:
- contact.create
- contact.update
- contact.delete

## Benefits:

1. **No more browser crashes** - Contacts are stored in database, not loaded in browser
2. **Fast search** - Database queries instead of loading all contacts
3. **Efficient chatbot** - The chatbot can now search contacts instantly
4. **Real-time sync** - Webhooks keep everything up to date automatically