/**
 * External I/O stand-ins for the balance-reading screens: the Peanut API
 * (`apiFetch`), the chain RPC clients, the passkey kernel and the session.
 * Everything between them (useWallet, the Rain overview query, the EURC
 * balance query, the currency-accounts service) runs for real.
 *
 * Wire it with factories that read this module lazily, e.g.
 *   jest.mock('@/utils/api-fetch', () => require('@/test-utils/balance-io').apiFetchModule)
 */
import type { CurrencyAccount, CurrencyAsset } from '@/services/currency-accounts'

export const WALLET_ADDRESS = '0x1111111111111111111111111111111111111111'
export const EURC_ADDRESS = `0x${'12'.repeat(20)}`
export const BASE_CHAIN_ID = 8453

export const EURC_ASSET_ROW: CurrencyAsset = {
    asset: 'EURC',
    currency: 'EUR',
    chainId: '8453',
    tokenAddress: '0x60a3e35cc302bfa44cb288bc5a4f316fdb1adb42',
    decimals: 6,
}
export const EURC_ACCOUNT: CurrencyAccount = {
    ...EURC_ASSET_ROW,
    id: 'eurc-1',
    address: EURC_ADDRESS,
    isDefault: false,
}
export const USDC_ACCOUNT: CurrencyAccount = {
    id: 'usdc-1',
    asset: 'USDC',
    currency: 'USD',
    chainId: '42161',
    tokenAddress: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
    decimals: 6,
    address: WALLET_ADDRESS,
    isDefault: true,
}

/** Six-decimal token units (USDC and EURC both use six). */
export const units = (amount: number) => BigInt(Math.round(amount * 1e6))

export type Reply = { status: number; body?: unknown }
type Handler<A extends unknown[] = []> = (...args: A) => Reply | Promise<Reply>

export const ok = (body: unknown): Reply => ({ status: 200, body })
export const fail = (status = 503): Reply => ({ status, body: { error: 'unavailable' } })
export const never = (): Promise<Reply> => new Promise<Reply>(() => {})

export const rainOverview = ({
    spendingPowerCents = 0,
    inTransitCents = 0,
    balanceUnavailable = false,
    withBalance = true,
}: {
    spendingPowerCents?: number
    inTransitCents?: number
    balanceUnavailable?: boolean
    withBalance?: boolean
} = {}) => ({
    status: { hasApplication: true },
    balance: withBalance
        ? {
              creditLimit: 0,
              spendingPower: spendingPowerCents,
              pendingCharges: 0,
              postedCharges: 0,
              balanceDue: 0,
              inTransitToCollateralCents: inTransitCents,
          }
        : null,
    balanceUnavailable,
    cards: [],
})

/** The backend's indicative-rate body (money-routes.ts exchange-rate route). */
export const rateBody = (rates: { midmarket: string; sell?: string; buy?: string }) => ({
    midmarket_rate: rates.midmarket,
    ...(rates.buy === undefined ? {} : { buy_rate: rates.buy }),
    ...(rates.sell === undefined ? {} : { sell_rate: rates.sell }),
    updated_at: new Date().toISOString(),
    indicative: true,
    developerFeePercent: '0',
})
export const flatRate = (rate: string) => rateBody({ midmarket: rate, sell: rate, buy: rate })

export type IoState = {
    userId: string | null
    requests: string[]
    accounts: jest.Mock<ReturnType<Handler>, []>
    rain: jest.Mock<ReturnType<Handler>, []>
    rate: jest.Mock<ReturnType<Handler<[string | null]>>, [string | null]>
    /** USDC balanceOf on the smart account (Arbitrum). */
    smartBalance: jest.Mock<Promise<bigint>, []>
    /** Any read against Base (chain 8453), i.e. the EURC balance. */
    baseRead: jest.Mock<Promise<bigint>, [unknown]>
}

export const io: IoState = {
    userId: 'alice',
    requests: [],
    accounts: jest.fn(),
    rain: jest.fn(),
    rate: jest.fn(),
    smartBalance: jest.fn(),
    baseRead: jest.fn(),
}

/** Funded EURC user: $10 on the smart account, 20 EURC on Base, flat 1.1 / 0.9 quotes. */
export function resetIo() {
    io.userId = 'alice'
    io.requests = []
    io.accounts.mockReset().mockImplementation(() => ok({ accounts: [USDC_ACCOUNT, EURC_ACCOUNT], available: [] }))
    io.rain.mockReset().mockImplementation(() => ok(rainOverview()))
    io.rate.mockReset().mockImplementation((from) => ok(flatRate(from === 'EURC' ? '1.1' : '0.9')))
    io.smartBalance.mockReset().mockResolvedValue(units(10))
    io.baseRead.mockReset().mockResolvedValue(units(20))
    window.localStorage.clear()
}

export const pricingRequests = () => io.requests.filter((request) => request.includes('/exchange-rate'))

function route(method: string, path: string): Reply | Promise<Reply> {
    const [pathname, query = ''] = path.split('?')
    if (method === 'GET' && pathname === '/users/currency-accounts') return io.accounts()
    if (method === 'GET' && pathname === '/rain/cards') return io.rain()
    if (method === 'GET' && pathname === '/users/currency-accounts/EURC/exchange-rate')
        return io.rate(new URLSearchParams(query).get('from'))
    return { status: 404, body: { error: `unexpected ${method} ${path}` } }
}

async function fakeApiFetch(path: string, init?: { method?: string }) {
    const method = (init?.method ?? 'GET').toUpperCase()
    io.requests.push(`${method} ${path}`)
    const reply = await route(method, path)
    const text = reply.body === undefined ? '' : JSON.stringify(reply.body)
    return {
        ok: reply.status >= 200 && reply.status < 300,
        status: reply.status,
        json: async () => (reply.body === undefined ? null : JSON.parse(text)),
        text: async () => text,
    }
}

export const apiFetchModule = { apiFetch: fakeApiFetch, serverFetch: fakeApiFetch }

const readOn = (chainId: number) => (args: unknown) =>
    chainId === BASE_CHAIN_ID ? io.baseRead(args) : io.smartBalance()

export const clientsModule = {
    peanutPublicClient: { readContract: readOn(42161) },
    getPublicClient: (chainId: number | string) => ({ readContract: readOn(Number(chainId)) }),
}

const sessionUser = () =>
    io.userId
        ? {
              user: { userId: io.userId, username: 'alice' },
              accounts: [{ type: 'peanut-wallet', identifier: WALLET_ADDRESS }],
          }
        : null

export const authModule = {
    useOptionalAuth: () => (io.userId ? { userId: io.userId, user: sessionUser() } : null),
    useAuth: () => ({
        userId: io.userId ?? undefined,
        user: sessionUser(),
        isFetchingUser: false,
        logoutUser: jest.fn(),
    }),
}

export const zeroDevModule = {
    useZeroDev: () => ({ address: WALLET_ADDRESS, isKernelClientReady: true, handleSendUserOpEncoded: jest.fn() }),
}
