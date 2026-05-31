/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'frdiafkdjeaslhwlvfxa.supabase.co' },
    ],
  },
  experimental: {
    outputFileTracingIncludes: {
      '/admin/manual': ['./docs/operations-manual.md'],
    },
  },
};

export default nextConfig;
