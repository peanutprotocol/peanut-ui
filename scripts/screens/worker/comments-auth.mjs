import { createRemoteJWKSet, jwtVerify } from 'jose'

const resolvers = new Map()
function resolver(issuer) {
    if (!resolvers.has(issuer)) {
        if (resolvers.size >= 8) resolvers.delete(resolvers.keys().next().value)
        resolvers.set(
            issuer,
            createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`), {
                timeoutDuration: 3000,
                cooldownDuration: 30000,
                cacheMaxAge: 300000,
            })
        )
    }
    return resolvers.get(issuer)
}

export class ApiError extends Error {
    constructor(status, message) {
        super(message)
        this.status = status
    }
}
export async function bounded(operation, ms = 5000) {
    let timer
    try {
        return await Promise.race([
            Promise.resolve().then(operation),
            new Promise((_, reject) => {
                timer = setTimeout(() => reject(new ApiError(503, 'Service unavailable')), ms)
            }),
        ])
    } finally {
        clearTimeout(timer)
    }
}
export async function authenticate(request, env, ctx) {
    const aud = env.SCREEN_LIBRARY_ACCESS_AUD
    if (typeof aud !== 'string' || !aud) throw new ApiError(401, 'Authentication required')
    let identity
    if (ctx?.access) {
        const audience = ctx.access.aud
        if (!(Array.isArray(audience) ? audience.includes(aud) : audience === aud))
            throw new ApiError(401, 'Authentication required')
        try {
            identity = await bounded(() => ctx.access.getIdentity())
        } catch {
            throw new ApiError(503, 'Authentication unavailable')
        }
    } else {
        const domain = env.SCREEN_LIBRARY_ACCESS_TEAM_DOMAIN
        const token = request.headers.get('Cf-Access-Jwt-Assertion')
        if (
            typeof domain !== 'string' ||
            !/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.cloudflareaccess\.com$/.test(domain) ||
            !token ||
            token.length > 16384
        )
            throw new ApiError(401, 'Authentication required')
        const issuer = `https://${domain}`
        try {
            const verified = await jwtVerify(token, resolver(issuer), {
                issuer,
                audience: aud,
                algorithms: ['RS256'],
                requiredClaims: ['exp', 'iss', 'aud'],
            })
            identity = verified.payload
        } catch (error) {
            const code = error?.code
            if (
                code &&
                [
                    'ERR_JWT_EXPIRED',
                    'ERR_JWT_CLAIM_VALIDATION_FAILED',
                    'ERR_JWS_SIGNATURE_VERIFICATION_FAILED',
                    'ERR_JOSE_ALG_NOT_ALLOWED',
                    'ERR_JOSE_NOT_SUPPORTED',
                    'ERR_JWS_INVALID',
                    'ERR_JWT_INVALID',
                    'ERR_JWKS_NO_MATCHING_KEY',
                    'ERR_JWKS_MULTIPLE_MATCHING_KEYS',
                ].includes(code)
            )
                throw new ApiError(401, 'Authentication required')
            throw new ApiError(503, 'Authentication unavailable')
        }
        if (identity.service_token_status || identity.common_name) throw new ApiError(403, 'Human identity required')
    }
    if (!identity || typeof identity.email !== 'string') throw new ApiError(401, 'Authentication required')
    const email = identity.email.trim().toLowerCase()
    if (email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        throw new ApiError(401, 'Authentication required')
    return {
        id: email,
        email,
        name: typeof identity.name === 'string' && identity.name.trim() ? identity.name.slice(0, 200) : email,
        service: !!identity.service_token_status || !!identity.common_name,
    }
}
