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

// Same as uploadToStorage but streams real upload progress (0-100) via a
// callback. Uses XHR against the Supabase Storage REST endpoint because the
// supabase-js .upload() helper does not expose upload progress events.
export async function uploadToStorageWithProgress(
  file: File,
  folder: 'images' | 'videos' | 'attachments',
  onProgress?: (percent: number) => void,
): Promise<string> {
  const supabase = createClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const token = session?.access_token || anonKey
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!

  const ext = file.name.split('.').pop() || 'bin'
  const safeName = `${folder}/${crypto.randomUUID()}.${ext}`
  const endpoint = `${baseUrl}/storage/v1/object/${BUCKET}/${safeName}`

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', endpoint)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.setRequestHeader('apikey', anonKey)
    xhr.setRequestHeader('cache-control', '3600')
    xhr.setRequestHeader('x-upsert', 'false')
    if (file.type) xhr.setRequestHeader('Content-Type', file.type)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    }
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`HTTP ${xhr.status}: ${xhr.responseText || 'فشل الرفع'}`))
    xhr.onerror = () => reject(new Error('network error'))
    xhr.send(file)
  })

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(safeName)
  return data.publicUrl
}
