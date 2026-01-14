/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Externalize libsql packages to avoid bundling issues
      config.externals.push('@libsql/client', '@prisma/adapter-libsql');
    }
    return config;
  },
};

module.exports = nextConfig;
