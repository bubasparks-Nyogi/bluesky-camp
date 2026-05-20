/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'frdiafkdjeaslhwlvfxa.supabase.co' },
    ],
  },
};

export default nextConfig;
