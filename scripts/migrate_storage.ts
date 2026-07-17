import { loadEnvConfig } from '@next/env'
// Load env vars (including .env.local) before importing anything else
loadEnvConfig(process.cwd())

import { runStorageMigration } from '../lib/media-migrate'

async function main() {
  console.log('🚀 Starting Storage Migration from Supabase to UploadThing...')
  
  try {
    const result = await runStorageMigration()
    console.log('\n✅ Migration Completed!')
    console.log(`Total Files Found: ${result.total}`)
    console.log(`Successfully Migrated: ${result.migrated}`)
    console.log(`Failed: ${result.failed}`)
    console.log(`Skipped: ${result.skipped}`)
    
    console.log('\n--- Detailed Logs ---')
    result.log.forEach(log => console.log(log))
  } catch (error) {
    console.error('❌ Migration failed with an exception:', error)
  }
}

main().catch(console.error)
