/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      // UploadThing (utfs.io + ufs.sh)
      { protocol: 'https', hostname: 'utfs.io' },
      { protocol: 'https', hostname: '*.ufs.sh' },
      // Cloudflare R2 public bucket (optional public domain)
      { protocol: 'https', hostname: '*.r2.dev' },
      // Supabase Storage (kept for any existing Supabase-hosted images)
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
}

export default nextConfig
