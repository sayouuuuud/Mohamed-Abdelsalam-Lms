import { createClient } from '@/lib/supabase/client'

const BUCKET = 'media'

// Uploads a file to the public Supabase Storage `media` bucket directly from the
// browser and returns its public URL. Used by the admin curriculum/lesson editors.
// Unlike UploadThing, this needs no server callback, so it works in preview/sandbox.
export async function uploadToStorage(
  file: File,
  folder: 'images' | 'videos' | 'attachments',
): Promise<string> {
  const supabase = createClient()

  const ext = file.name.split('.').pop() || 'bin'
  const safeName = `${folder}/${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(safeName, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  })

  if (error) {
    console.log('[v0] storage upload error:', error.message)
    throw new Error(error.message)
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(safeName)
  return data.publicUrl
}
