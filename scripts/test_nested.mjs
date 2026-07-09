import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const LECTURE_SELECT = `
  id, slug, title, description, image, instructor, what_you_learn,
  branches:branch_id ( title, image, stages:stage_id ( title ) ),
  lessons ( id, slug, title, duration, is_free, sort_order, video_url, description, content_type, attachments )
`;

async function main() {
  const { data, error } = await supabase
    .from('lectures')
    .select(LECTURE_SELECT);


  if (data) {
    for (const row of data) {
      if (row.lessons) {
        for (const l of row.lessons) {
          if (l.attachments && l.attachments.length > 0) {
            console.log('Found attachments in lesson', l.id);
            console.log('Type of attachments:', typeof l.attachments);
            console.log('Is Array?', Array.isArray(l.attachments));
            console.log('Value:', JSON.stringify(l.attachments, null, 2));
            return;
          }
        }
      }
    }
    console.log('No attachments found in any lesson');
  }
}

main();
