import supabase from './supabase.js'

async function testConnection() {
  try {
    // Test 1: Check if we can connect and get tables
    console.log('Testing Supabase connection...')
    
    // Get list of tables (requires permissions)
    const { data: tables, error: tablesError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
    
    if (tablesError) {
      console.log('Note: Cannot list tables with anon key (expected behavior)')
    } else {
      console.log('Available tables:', tables)
    }
    
    // Test 2: Try a simple query (you'll need to replace 'your_table' with an actual table name)
    // const { data, error } = await supabase
    //   .from('your_table')
    //   .select('*')
    //   .limit(1)
    
    // if (error) {
    //   console.error('Query error:', error)
    // } else {
    //   console.log('Sample data:', data)
    // }
    
    console.log('\nSupabase client is configured and ready!')
    console.log('URL:', process.env.SUPABASE_URL)
    
  } catch (error) {
    console.error('Connection error:', error)
  }
}

// Example: Create a new table
async function createExampleTable() {
  // Note: Creating tables requires service role key, not anon key
  console.log('\nTo create tables, you need to use Supabase Dashboard or SQL editor')
  console.log('Or use a service role key instead of anon key')
}

// Example: Basic CRUD operations (once you have a table)
async function exampleCRUD() {
  console.log('\n--- Example CRUD Operations ---')
  console.log('Once you have tables created, you can use:')
  console.log(`
// INSERT
const { data, error } = await supabase
  .from('your_table')
  .insert([{ column1: 'value1', column2: 'value2' }])

// SELECT
const { data, error } = await supabase
  .from('your_table')
  .select('*')

// UPDATE
const { data, error } = await supabase
  .from('your_table')
  .update({ column1: 'new_value' })
  .eq('id', 1)

// DELETE
const { data, error } = await supabase
  .from('your_table')
  .delete()
  .eq('id', 1)
  `)
}

// Run tests
testConnection()
createExampleTable()
exampleCRUD()