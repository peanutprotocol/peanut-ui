/**
 * Every Mobula call spends a plan quota that ran out in production
 * (TASK-23172), and this public endpoint used to spend two per hit — one of
 * them the expensive wallet-portfolio call — for anyone who loaded it. One
 * verdict now serves every caller for five minutes, and concurrent callers
 * share a single request.
 */

const VERDICT_TTL_MS = 5 * 60 * 1000
const PROBE_TIMEOUT_MS = 8000
const TEST_ASSET = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' // USDC on Ethereum

export interface MobulaVerdict {
    httpStatus: number
    body: {
        status: 'healthy' | 'unhealthy'
        service: 'mobula'
        timestamp: string
        responseTime: number
        error?: string
        details?: { priceApi: { status: 'healthy'; responseTime: number; testAsset: string; price: number } }
    }
}

let cached: { at: number; verdict: MobulaVerdict } | null = null
let inflight: Promise<MobulaVerdict> | null = null

function unhealthy(startedAt: number, error: string): MobulaVerdict {
    return {
        httpStatus: 500,
        body: {
            status: 'unhealthy',
            service: 'mobula',
            timestamp: new Date(startedAt).toISOString(),
            responseTime: Date.now() - startedAt,
            error,
        },
    }
}

async function probe(): Promise<MobulaVerdict> {
    const startedAt = Date.now()
    const apiKey = process.env.MOBULA_API_KEY
    if (!apiKey) return unhealthy(startedAt, 'MOBULA_API_KEY not configured')
    try {
        const response = await fetch(
            `${process.env.MOBULA_API_URL}/api/1/market/data?asset=${TEST_ASSET}&blockchain=1`,
            {
                headers: { 'Content-Type': 'application/json', authorization: apiKey },
                cache: 'no-store',
                signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
            }
        )
        if (!response.ok) return unhealthy(startedAt, `Price API returned ${response.status}`)
        const data = (await response.json().catch(() => null)) as { data?: { price?: unknown } } | null
        const price = data?.data?.price
        if (typeof price !== 'number') return unhealthy(startedAt, 'Invalid price data structure')
        const responseTime = Date.now() - startedAt
        return {
            httpStatus: 200,
            body: {
                status: 'healthy',
                service: 'mobula',
                timestamp: new Date(startedAt).toISOString(),
                responseTime,
                details: { priceApi: { status: 'healthy', responseTime, testAsset: 'USDC', price } },
            },
        }
    } catch (error) {
        return unhealthy(startedAt, error instanceof Error ? error.message : 'Unknown error')
    }
}

export async function getMobulaVerdict(now: number = Date.now()): Promise<MobulaVerdict> {
    if (cached && now - cached.at < VERDICT_TTL_MS) return cached.verdict
    if (!inflight) {
        inflight = probe()
            .then((verdict) => {
                cached = { at: Date.now(), verdict }
                return verdict
            })
            .finally(() => {
                inflight = null
            })
    }
    return inflight
}

/** Test-only — forget the cached verdict between cases. */
export function _resetMobulaVerdict(): void {
    cached = null
    inflight = null
}
