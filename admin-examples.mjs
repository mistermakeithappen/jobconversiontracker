import supabaseAdmin from './supabase-admin.js'

// Example: Create a table using the admin client
async function createTable() {
  try {
    // Create a users table
    const { data, error } = await supabaseAdmin.rpc('query', {
      query: `
        CREATE TABLE IF NOT EXISTS users (
          id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          name TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
        );
      `
    })
    
    if (error) {
      console.error('Error creating table:', error)
    } else {
      console.log('Table created successfully!')
    }
  } catch (err) {
    console.error('Error:', err)
  }
}

// Example: List all tables
async function listTables() {
  try {
    const { data, error } = await supabaseAdmin
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
    
    if (error) {
      console.error('Error listing tables:', error)
    } else {
      console.log('Available tables:')
      data.forEach(table => console.log(`- ${table.table_name}`))
    }
  } catch (err) {
    console.error('Error:', err)
  }
}

// Example: Insert data with admin privileges
async function insertData() {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .insert([
        { email: 'admin@example.com', name: 'Admin User' },
        { email: 'test@example.com', name: 'Test User' }
      ])
      .select()
    
    if (error) {
      console.error('Error inserting data:', error)
    } else {
      console.log('Data inserted:', data)
    }
  } catch (err) {
    console.error('Error:', err)
  }
}

// Example: Create RLS policies
async function createRLSPolicies() {
  try {
    // Enable RLS on users table
    await supabaseAdmin.rpc('query', {
      query: 'ALTER TABLE users ENABLE ROW LEVEL SECURITY;'
    })
    
    // Create policy for users to read their own data
    await supabaseAdmin.rpc('query', {
      query: `
        CREATE POLICY "Users can view own data" ON users
        FOR SELECT USING (auth.uid() = id);
      `
    })
    
    console.log('RLS policies created successfully!')
  } catch (err) {
    console.error('Error creating policies:', err)
  }
}

// Run examples
console.log('=== Supabase Admin Examples ===\n')

// Uncomment the functions you want to run:
// await createTable()
await listTables()
// await insertData()
// await createRLSPolicies()

console.log('\n=== Admin client is ready for use! ===')
console.log('Remember: Never expose the service key to client-side code!')