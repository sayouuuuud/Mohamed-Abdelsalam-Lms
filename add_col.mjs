import { createClient } from '@supabase/supabase-js';  
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);  
async function run() { const { error } = await supabase.rpc('exec_sql', { sql: 'ALTER TABLE lectures ADD COLUMN IF NOT EXISTS features text[] DEFAULT ARRAY[]::text[];' }); console.log(error); } run(); 
