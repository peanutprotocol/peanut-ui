/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    WC_PROJECT_ID: process.env.WC_PROJECT_ID,
    SOCKET_API_KEY: process.env.SOCKET_API_KEY,
    PEANUT_API_KEY: process.env.PEANUT_API_KEY,
    OPTI_GOERLI_RPC_URL: process.env.OPTI_GOERLI_RPC_URL,
    GOERLI_RPC_URL: process.env.GOERLI_RPC_URL,
  },
};

module.exports = nextConfig;
