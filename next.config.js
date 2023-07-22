/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    WC_PROJECT_ID: process.env.WC_PROJECT_ID,
    SOCKET_API_KEY: process.env.SOCKET_API_KEY,
  },
};

module.exports = nextConfig;
