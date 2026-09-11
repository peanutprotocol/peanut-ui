/**
 * Target inventory for the full i18n overflow sweep. Enumerated from
 * src/app/[locale]/(marketing) generateStaticParams + the content tree
 * (2026-09-11). Every slug runs at 320px in all four URL locales; the
 * REPRESENTATIVES (one per template + every composition-flagged slug) also
 * run at 375/393/430. /status is excluded: revalidate=0 live incident feed,
 * nondeterministic by design.
 */

export const MARKETING_LOCALES = ['en', 'es-419', 'es-ar', 'pt-br'] as const

const COUNTRIES = [
    'argentina',
    'australia',
    'brazil',
    'canada',
    'chile',
    'colombia',
    'costa-rica',
    'france',
    'germany',
    'india',
    'indonesia',
    'italy',
    'japan',
    'kenya',
    'malaysia',
    'mexico',
    'netherlands',
    'nigeria',
    'pakistan',
    'peru',
    'philippines',
    'poland',
    'portugal',
    'saudi-arabia',
    'singapore',
    'south-africa',
    'spain',
    'sweden',
    'tanzania',
    'thailand',
    'turkey',
    'united-arab-emirates',
    'united-kingdom',
    'united-states',
    'vietnam',
]

const RECEIVE_FROM = [
    'argentina',
    'australia',
    'brazil',
    'france',
    'germany',
    'india',
    'italy',
    'kenya',
    'malaysia',
    'netherlands',
    'pakistan',
    'philippines',
    'portugal',
    'saudi-arabia',
    'singapore',
    'spain',
    'united-arab-emirates',
    'united-kingdom',
    'united-states',
]

const SEND_PAIRS = [
    ['brazil', 'argentina'],
    ['colombia', 'argentina'],
    ['france', 'argentina'],
    ['germany', 'argentina'],
    ['italy', 'argentina'],
    ['mexico', 'argentina'],
    ['spain', 'argentina'],
    ['united-kingdom', 'argentina'],
    ['united-states', 'argentina'],
    ['argentina', 'brazil'],
    ['colombia', 'brazil'],
    ['germany', 'brazil'],
    ['mexico', 'brazil'],
    ['portugal', 'brazil'],
    ['united-kingdom', 'brazil'],
    ['united-states', 'brazil'],
]

const COMPARE = ['binance-p2p', 'paypal', 'revolut', 'western-union', 'wise']
const DEPOSIT_FROM = [
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
const DEPOSIT_VIA = [
    'ach',
    'sepa',
    'wire',
    'faster-payments',
    'spei',
    'arbitrum',
    'base',
    'ethereum',
    'polygon',
    'solana',
    'tron',
]
const PAY_WITH = [
    'bizum',
    'blik',
    'cashapp',
    'codi',
    'duitnow',
    'fast-turkey',
    'fps',
    'gcash',
    'interac',
    'mbway',
    'mercadopago',
    'momo',
    'mpesa',
    'npp',
    'paynow',
    'payshap',
    'pix',
    'promptpay',
    'qris',
    'raast',
    'sinpe-movil',
    'swish',
    'transfiya',
    'uaefts',
    'venmo',
    'yape',
    'zengin-net',
]
const WITHDRAW = [
    'ach',
    'arbitrum',
    'base',
    'ethereum',
    'faster-payments',
    'polygon',
    'solana',
    'spei',
    'to-bank',
    'tron',
]
const USE_CASES = ['cross-border-travel', 'digital-nomads', 'families', 'remote-workers', 'tourists']
const HELP = [
    'account-recovery',
    'card-collateral',
    'card-payments',
    'delete-account',
    'deposit-bank',
    'deposit-crypto',
    'deposit-not-showing',
    'dollar-rates-argentina',
    'fees-pricing',
    'mercadopago-account',
    'mercadopago-merchants',
    'mercadopago-qr',
    'mercadopago-without-dni',
    'passkeys',
    'payment-not-received',
    'peanut-card',
    'qr-troubleshooting',
    'recover-wrong-token',
    'referrals',
    'refunds',
    'request-money',
    'rewards',
    'rewards-card-payments',
    'rewards-claiming',
    'rewards-earning',
    'rewards-not-showing',
    'rewards-vs-points',
    'security-custody',
    'security-disclosure',
    'send-euros-argentina',
    'send-money-link',
    'supported-geographies',
    'transaction-limits',
    'verification',
    'waitlist-invite-codes',
    'what-are-digital-dollars',
    'withdraw-bank',
    'withdraw-crypto',
]
const STORIES = ['arsenii', 'cat', 'kamila', 'lynn', 'mei', 'purple']
const BLOG = [
    'earn-with-peanut-3min-setup',
    'earn-with-peanut-passive-income',
    'rewards-v2-savings-calculator',
    'rewards-v2-thank-you',
    'rewards-v2-the-receipts',
    'stablecoin-balance-visa-merchants',
]
// legal prose is English in every locale (fallback by design), but all four
// URL locales are prerendered — sweep them all; the chrome around the prose
// is still localized
const LEGAL = [
    'terms',
    'privacy',
    'card-esign',
    'card-privacy',
    'card-prohibited-activities',
    'card-terms-international',
    'card-terms-us',
]

export type MarketingTarget = {
    /** path with {locale} placeholder; landing uses fixed per-locale paths */
    path: string
    /** run at every width, not just 320 */
    allWidths?: boolean
    /** restrict URL locales (legal = en only) */
    locales?: readonly string[]
}

// representatives: one per template + every composition-flagged slug
const REP = new Set([
    '/{locale}/argentina', // CountryGrid
    '/{locale}/send-money-to/argentina', // the only <Tabs> user
    '/{locale}/send-money-from/united-states/to/argentina',
    '/{locale}/receive-money-from/spain',
    '/{locale}/compare/peanut-vs-wise', // ExchangeWidget + ArticleLocaleNav
    '/{locale}/deposit/from-binance',
    '/{locale}/deposit/via-sepa', // second slug shape of the template
    '/{locale}/pay-with/mercadopago',
    '/{locale}/withdraw/to-bank',
    '/{locale}/use-cases/digital-nomads',
    '/{locale}/help/fees-pricing', // the ExchangeWidget help article
    '/{locale}/stories/cat',
    '/{locale}/blog/rewards-v2-thank-you',
    '/{locale}/pricing',
    '/{locale}/supported-networks',
    '/{locale}/help',
    '/{locale}/content',
    '/{locale}/stories',
])

const paths: string[] = [
    ...COUNTRIES.map((c) => `/{locale}/${c}`),
    ...COUNTRIES.map((c) => `/{locale}/send-money-to/${c}`),
    ...SEND_PAIRS.map(([f, t]) => `/{locale}/send-money-from/${f}/to/${t}`),
    ...RECEIVE_FROM.map((c) => `/{locale}/receive-money-from/${c}`),
    ...COMPARE.map((s) => `/{locale}/compare/peanut-vs-${s}`),
    ...DEPOSIT_FROM.map((s) => `/{locale}/deposit/from-${s}`),
    ...DEPOSIT_VIA.map((s) => `/{locale}/deposit/via-${s}`),
    ...PAY_WITH.map((s) => `/{locale}/pay-with/${s}`),
    ...WITHDRAW.map((s) => `/{locale}/withdraw/${s}`),
    ...USE_CASES.map((s) => `/{locale}/use-cases/${s}`),
    ...HELP.map((s) => `/{locale}/help/${s}`),
    ...STORIES.map((s) => `/{locale}/stories/${s}`),
    ...BLOG.map((s) => `/{locale}/blog/${s}`),
    '/{locale}/pricing',
    '/{locale}/supported-networks',
    '/{locale}/help',
    '/{locale}/content',
    '/{locale}/stories',
    '/{locale}/press',
]

export const MARKETING_TARGETS: MarketingTarget[] = [
    ...paths.map((path) => ({ path, allWidths: REP.has(path) })),
    ...LEGAL.map((s) => ({ path: `/{locale}/${s}` })),
]

/**
 * App routes the fixture registry does not open on its own (registry fixtures
 * pin states on ~21 routes; these are the remaining prerendered product
 * surfaces). All run on the default demo fixture — a route that bounces to
 * /setup or /home records a skip cell, which is a visible coverage gap, not
 * a silent pass.
 */
export const EXTRA_APP_ROUTES: OverlayTarget[] = [
    { id: 'route-qr-pay', route: '/qr-pay' },
    { id: 'route-recover-funds', route: '/recover-funds' },
    { id: 'route-recover-wallet', route: '/recover-wallet' },
    { id: 'route-card', route: '/card' },
    { id: 'route-card-limit', route: '/card/limit' },
    { id: 'route-card-physical', route: '/card/physical' },
    { id: 'route-card-add-to-wallet', route: '/card/add-to-wallet' },
    { id: 'route-card-recovery', route: '/card-recovery' },
    // /points renamed to /rewards — the sweep's redirect skip caught it
    { id: 'route-rewards', route: '/rewards' },
    { id: 'route-rewards-invites', route: '/rewards/invites' },
    { id: 'route-profile-about', route: '/profile/about' },
    { id: 'route-profile-exchange-rate', route: '/profile/exchange-rate' },
    { id: 'route-profile-view', route: '/profile/view?username=demo' },
    // /qr (needs a claim code), /add-money/us/bank and /withdraw/{crypto,manteca}
    // (need mid-flow state) bounce without deeper harness work — the withdraw
    // and add-money fixtures cover those screens' entry states
    { id: 'route-limits-bridge', route: '/limits/bridge' },
    { id: 'route-kyc-success', route: '/kyc/success' },
    { id: 'route-shhhhh', route: '/shhhhh' },
]

/** the four landing pages live outside [locale] */
export const LANDING_TARGETS: { locale: string; path: string }[] = [
    { locale: 'en', path: '/' },
    { locale: 'es-419', path: '/es-419' },
    { locale: 'es-ar', path: '/es-ar' },
    { locale: 'pt-br', path: '/pt-br' },
]

/**
 * App overlay states beyond the plain fixture routes. `clickKeys` are
 * catalog key paths resolved to the active locale's label at test time.
 */
export type OverlayTarget = {
    id: string
    route: string
    fixture?: string
    clickKeys?: string[]
    /** selector that must be visible — proves the overlay actually opened */
    proof?: string
}

export const OVERLAY_TARGETS: OverlayTarget[] = [
    { id: 'backup-lose-phone', route: '/profile/backup', clickKeys: ['profile.backup.faq.losePhone'] },
    { id: 'backup-change-phone', route: '/profile/backup', clickKeys: ['profile.backup.faq.changePhone'] },
    { id: 'backup-export-keys', route: '/profile/backup', clickKeys: ['profile.backup.faq.exportKeys'] },
    { id: 'home-add-drawer', route: '/home?drawer=add', proof: '[data-vaul-drawer], [role="dialog"]' },
    { id: 'home-send-drawer', route: '/home?drawer=send', proof: '[data-vaul-drawer], [role="dialog"]' },
    { id: 'add-money-bank-list', route: '/add-money?method=bank', fixture: 'add-money' },
    { id: 'profile-avatar-picker', route: '/profile?avatarPicker=true', proof: '[data-vaul-drawer], [role="dialog"]' },
    { id: 'withdraw-all-methods', route: '/withdraw?showAll=true', fixture: 'withdraw' },
    { id: 'limits-argentina', route: '/limits?region=argentina' },
    { id: 'limits-brazil', route: '/limits?region=brazil' },
    { id: 'card-pin-set', route: '/card/pin?mode=set' },
]
