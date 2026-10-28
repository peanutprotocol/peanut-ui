// Kept free of imports so the service worker can match the API origin without bundling general.consts.
export const PEANUT_API_URL = (
    process.env.PEANUT_API_URL ||
    process.env.NEXT_PUBLIC_PEANUT_API_URL ||
    'https://api.peanut.me'
).replace(/\/$/, '') // remove any accidental trailing slash
