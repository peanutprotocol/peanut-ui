/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    CLIENT_ID: process.env.CLIENT_ID,
    INFURA_ID: process.env.INFURA_ID,
    WC_PROJECT_ID: process.env.WC_PROJECT_ID,
  },
};

module.exports = nextConfig;
