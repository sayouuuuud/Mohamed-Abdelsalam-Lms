import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data, error } = await supabase
    .from('lessons')
    .select('id, attachments')
    .not('attachments', 'is', null)
    .neq('attachments', '[]');
  console.log(JSON.stringify(data, null, 2));
}

main();
