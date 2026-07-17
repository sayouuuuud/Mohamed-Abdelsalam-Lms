import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Creating claim_next_video_job function...')
  try {
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION public.claim_next_video_job()
       RETURNS TABLE(job_id uuid, video_id uuid, r2_raw_key text, threads_override integer)
       LANGUAGE plpgsql
      AS $function$
      DECLARE
        v_job_id UUID;
        v_video_id UUID;
        v_r2_raw_key TEXT;
      BEGIN
        SELECT vj.id, vj.video_id, v.r2_raw_key
        INTO v_job_id, v_video_id, v_r2_raw_key
        FROM video_jobs vj
        JOIN videos v ON v.id = vj.video_id
        WHERE vj.status = 'pending' 
           OR (vj.status = 'processing' AND vj.updated_at < NOW() - INTERVAL '1 hour')
        ORDER BY vj.created_at ASC
        FOR UPDATE OF vj SKIP LOCKED
        LIMIT 1;

        IF v_job_id IS NOT NULL THEN
          UPDATE video_jobs
          SET status = 'processing',
              updated_at = NOW(),
              claimed_at = NOW(),
              attempts = attempts + 1
          WHERE id = v_job_id;

          RETURN QUERY SELECT v_job_id, v_video_id, v_r2_raw_key, NULL::integer;
        END IF;
      END;
      $function$;
    `)
    console.log('Function created successfully.')
  } catch (err) {
    console.error('Error creating function:', err)
  }
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
