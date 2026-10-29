/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  // nginx serves directories with index.html; nested pages must survive a direct reload.
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
}

export default nextConfig
