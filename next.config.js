/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Linting runs through `npm run lint` with the repo's own flat config.
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    optimizePackageImports: ['antd'],
  },
};
