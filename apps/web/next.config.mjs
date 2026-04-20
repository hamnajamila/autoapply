/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api-proxy/:path*",
        destination: "http://api:3001/:path*"
      }
    ];
  },
  webpack: (config) => {
    config.cache = false;
    return config;
  }
};

export default nextConfig;

