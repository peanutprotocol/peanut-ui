// TODO: get from .env, and not from hardcoded variable

// if dev, use api.staging.peanut.to, else use api.peanut.to
export const PEANUT_API_URL =
    process.env.NODE_ENV === 'development' ? 'https://api.staging.peanut.to/' : 'https://api.peanut.to/'
