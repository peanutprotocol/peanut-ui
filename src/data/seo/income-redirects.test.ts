import { getPathMatch } from 'next/dist/shared/lib/router/utils/path-match'
import { prepareDestination } from 'next/dist/shared/lib/router/utils/prepare-destination'
import { readPageContentLocalizedResolved, type ContentFrontmatter } from '@/lib/content'

interface RedirectRule {
    source: string
    destination: string
    permanent: boolean
    has?: unknown[]
}

const networks = ['arbitrum', 'base', 'ethereum', 'polygon', 'solana', 'tron']
const exchanges = [
    'belo',
    'binance',
    'bitso',
    'buenbit',
    'bybit',
    'coinbase',
    'crypto-com',
    'kraken',
    'kucoin',
    'lemon',
    'metamask',
    'okx',
    'phantom',
    'revolut-exchange',
    'ripio',
]
const merges = [
    ...networks.map((slug) => [`deposit/via-${slug}`, 'help/deposit-crypto']),
    ...exchanges.map((slug) => [`deposit/from-${slug}`, 'help/deposit-crypto']),
    ...networks.map((slug) => [`withdraw/${slug}`, 'help/withdraw-crypto']),
    ...['france', 'germany', 'italy', 'netherlands', 'portugal', 'spain'].map((slug) => [
        `receive-money-from/${slug}`,
        'deposit/from-eur-account',
    ]),
    ['receive-money-from/united-states', 'deposit/from-usd-account'],
    ['receive-money-from/united-kingdom', 'deposit/from-gbp-account'],
    ['pay-with/fps', 'withdraw/faster-payments'],
]
const localeOwners = {
    en: 'en',
    'es-419': 'es-419',
    'es-ar': 'es-419',
    'pt-br': 'pt-br',
    es: 'es-419',
    'es-es': 'es-419',
    pt: 'pt-br',
    '': 'en',
} as const

let rules: RedirectRule[]
beforeAll(async () => {
    const previousNodeEnv = process.env.NODE_ENV
    const previousLocalBuild = process.env.LOCAL_BUILD
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    try {
        process.env.LOCAL_BUILD = 'true'
        Object.defineProperty(process.env, 'NODE_ENV', { configurable: true, value: 'development', writable: true })
        let config: { redirects: () => Promise<RedirectRule[]> }
        jest.isolateModules(() => {
            config = require('../../../next.config.js')
        })
        // Production rules are selected when redirects() runs. Avoid loading the
        // service-worker compiler, which does not change the redirect table.
        Object.defineProperty(process.env, 'NODE_ENV', { configurable: true, value: 'production', writable: true })
        rules = await config!.redirects()
    } finally {
        Object.defineProperty(process.env, 'NODE_ENV', { configurable: true, value: previousNodeEnv, writable: true })
        if (previousLocalBuild === undefined) delete process.env.LOCAL_BUILD
        else process.env.LOCAL_BUILD = previousLocalBuild
        log.mockRestore()
    }
})

function matchRedirect(pathname: string) {
    return rules.find((rule) => !rule.has && getPathMatch(rule.source)(pathname))
}

it('merges all 36 topics and all 8 locale/bare aliases directly to a permanent content owner', () => {
    expect(merges).toHaveLength(36)
    for (const [source, target] of merges) {
        for (const [locale, owner] of Object.entries(localeOwners)) {
            const pathname = locale ? `/${locale}/${source}` : `/${source}`
            const destination = `/${owner}/${target}`
            const rule = matchRedirect(pathname)
            expect(rule).toMatchObject({ source: pathname, destination, permanent: true })
            expect(matchRedirect(destination)).toBeUndefined()
            const [intent, rawSlug] = target.split('/')
            const slug = rawSlug.replace(/^from-/, '')
            const resolved = readPageContentLocalizedResolved<ContentFrontmatter>(intent, slug, owner)
            expect(resolved?.lang).toBe(owner)
        }
    }
})

it('keeps query parameters and handles the trailing-slash match with Next routing utilities', () => {
    const pathname = '/es-es/deposit/from-binance/'
    const rule = matchRedirect(pathname)!
    const params = getPathMatch(rule.source)(pathname)
    expect(params).toBeTruthy()
    const result = prepareDestination({
        appendParamsToQuery: false,
        destination: rule.destination,
        params: params || {},
        query: { utm_source: 'migration-check', reference: 'invoice' },
    })
    expect(result.parsedDestination.pathname).toBe('/es-419/help/deposit-crypto')
    expect(result.parsedDestination.query).toEqual({ utm_source: 'migration-check', reference: 'invoice' })
})

it('does not redirect unrelated sender, family or planned-method tasks into income or help', () => {
    for (const path of [
        '/en/send-money-to/brazil',
        '/en/send-money-from/germany/to/brazil',
        '/en/use-cases/families',
        '/en/pay-with/venmo',
        '/en/receive-money-from/india',
    ]) {
        expect(matchRedirect(path)).toBeUndefined()
    }
})
