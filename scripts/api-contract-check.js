const { REQUIRED_API_CONTRACTS } = require('../src/constants/api-contracts.json')
const MISSING_ENDPOINT = Symbol('missing endpoint')

async function fetchJson(url, fetchImpl, timeoutMs) {
    const controller = new AbortController()
    let timer
    try {
        return await Promise.race([
            (async () => {
                const response = await fetchImpl(url, {
                    signal: controller.signal,
                    cache: 'no-store',
                    credentials: 'omit',
                })
                if (response.status === 404) return MISSING_ENDPOINT
                if (!response.ok) throw new Error(`HTTP ${response.status}`)
                return response.json()
            })(),
            new Promise((_, reject) => {
                timer = setTimeout(() => {
                    controller.abort()
                    reject(new Error('API contract check timeout'))
                }, timeoutMs)
            }),
        ])
    } finally {
        clearTimeout(timer)
    }
}

async function checkApiContracts({
    apiUrl,
    production = false,
    skip = false,
    fetchImpl = globalThis.fetch,
    requiredOperations = [{ path: '/users/kyc/plan', method: 'get' }],
    logger = console,
    timeoutMs = 5000,
}) {
    if (skip) {
        logger.warn('🚨 SKIP_API_CONTRACT_CHECK=1: SKIPPING API CONTRACT AND ROUTE CHECKS')
        return
    }
    const failures = []
    const base = (apiUrl || '').replace(/\/+$/, '')
    if (!/^https?:\/\//.test(base)) {
        const message = 'API contract check requires NEXT_PUBLIC_PEANUT_API_URL'
        if (!production) throw new Error(message)
        logger.warn(`⚠️ ${message}`)
        return
    }
    const results = await Promise.allSettled([
        fetchJson(`${base}/version`, fetchImpl, timeoutMs),
        fetchJson(`${base}/openapi.json`, fetchImpl, timeoutMs),
    ])
    const [versionResult, specResult] = results
    if (versionResult.status === 'rejected')
        failures.push(
            `Cannot verify /version (${versionResult.reason instanceof Error && versionResult.reason.message.includes('timeout') ? 'timeout' : 'request or JSON failure'})`
        )
    else {
        const version = versionResult.value
        for (const [name, required] of Object.entries(REQUIRED_API_CONTRACTS)) {
            const actual = version === MISSING_ENDPOINT ? 0 : version?.contracts?.[name]
            if (!Number.isSafeInteger(actual) || actual < required) {
                failures.push(
                    `API contract ${name}: requires v${required}, received ${Number.isSafeInteger(actual) ? `v${actual}` : 'invalid or missing version'}`
                )
            }
        }
    }
    if (specResult.status === 'rejected')
        failures.push('Cannot verify /openapi.json (request, JSON failure or timeout)')
    else if (specResult.value === MISSING_ENDPOINT) logger.warn('⚠️ API has no /openapi.json; checking contracts only')
    else if (
        !specResult.value?.paths ||
        typeof specResult.value.paths !== 'object' ||
        Array.isArray(specResult.value.paths)
    )
        failures.push('Cannot verify /openapi.json (invalid paths)')
    else {
        const normalize = (path) => path.replace(/\{[^}]+\}/g, '{}')
        const livePaths = new Map(
            Object.entries(specResult.value.paths).map(([path, methods]) => [normalize(path), methods])
        )
        for (const { path, method } of requiredOperations) {
            if (!livePaths.get(normalize(path))?.[method.toLowerCase()])
                failures.push(`API missing ${method.toUpperCase()} ${path}`)
        }
    }
    if (failures.length) {
        const message = `API incompatible with this app:\n${failures.join('\n')}\nUpdate the API or set SKIP_API_CONTRACT_CHECK=1 to explicitly bypass.`
        if (!production) throw new Error(message)
        logger.warn(`⚠️ ${message}`)
    } else if (specResult.value !== MISSING_ENDPOINT)
        logger.log(`✅ API contracts and ${requiredOperations.length} called operations checked`)
}

module.exports = { checkApiContracts }
