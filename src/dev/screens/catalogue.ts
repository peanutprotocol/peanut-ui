import { FIXTURES } from '../fixtures/registry'
import { SURFACE_META } from '../surfaces/list'
import { PAGE_CAPTURES, type PageCapture } from './pages'
import { FLAG_VARIANTS } from './flag-variants'

export type Screen = {
    id: string
    name: string
    flow: string
    kind: 'route' | 'component'
    defaultScreen: boolean
    route: string
    camera?: 'synthetic' | 'denied'
    videoFrame?: number
    sessionStorage?: Record<string, string>
    requiresSource?: string
    entryRoute?: string
    actions?: PageCapture['actions']
    expectSelector?: string
    waitFor?: string
    geoCountry?: string
    routePattern?: string
    fixture: string
    clicks: string[]
    clickTestIds?: string[]
    source?: string
    captureState?: string[]
    exclusion?: string
    unavailable?: string
    toBottom?: boolean
    event?: 'rain:cooldown' | 'rain:stale-card-approval'
    storage?: Record<string, string>
    expectsLoading?: boolean
    expectedHttpStatus?: number | number[]
    expectText?: string
    order?: number
    journey?: string
    /** PostHog flags this capture sets; see flag-variants.ts. */
    flags?: Record<string, boolean | string>
}
const flow = (value: string): string => {
    const rules = [
        ['badge|reward|points|perk', 'Rewards'],
        ['setup|landing|passkey|signup|residence|install|guest|invite', 'Setup and login'],
        ['kyc|identity|consent|email|bridgetos|reject', 'Verification'],
        ['card|rain', 'Card'],
        ['add.money|onramp|deposit', 'Add money'],
        ['withdraw|recover', 'Withdraw'],
        ['send|claim|request|qr|contribut|transaction', 'Payments'],
        ['profile|language|avatar|support|/settings(?:/details)?(?:[?\\s]|$)', 'Profile and settings'],
    ]
    return rules.find(([pattern]) => new RegExp(pattern, 'i').test(value))?.[1] ?? 'Home and shared states'
}
const definitions: Screen[] = [
    ...Object.entries(FIXTURES).flatMap(([fixture, definition]) =>
        (definition.views ?? []).map((view) => ({
            ...view,
            fixture,
            kind: (view.route.startsWith('/dev/') ? 'component' : 'route') as Screen['kind'],
            defaultScreen: false,
            clicks: [],
        }))
    ),
    ...Object.entries(FIXTURES).map(([id, f]) => ({
        id: `fixture-${id}`,
        name: f.about,
        flow: flow(`${id} ${f.route}`),
        kind: 'route' as const,
        defaultScreen: false,
        route: f.landsOn ?? f.route,
        entryRoute: f.landsOn ? f.route : undefined,
        fixture: id,
        waitFor: f.waitFor,
        geoCountry: f.geoCountry,
        sessionStorage: f.sessionStorage,
        clicks: [],
        ...f.capture,
        expectsLoading: f.isLoadingState ?? false,
    })),
    ...PAGE_CAPTURES.map((p) => ({
        ...p,
        // a page capture served by a fixture opens with that fixture's session values too
        sessionStorage: p.fixture ? FIXTURES[p.fixture]?.sessionStorage : undefined,
        flow: flow(p.route),
        kind: (p.route.startsWith('/dev/') ? 'component' : 'route') as Screen['kind'],
        defaultScreen:
            p.defaultScreen ??
            (!p.route.startsWith('/dev/') &&
                !p.route.includes('drawer=') &&
                !p.clicks?.length &&
                !p.actions?.length &&
                !p.expectSelector),
        fixture: p.fixture ?? 'profile-edit',
        clicks: p.clicks ?? [],
    })),
    ...Object.entries(SURFACE_META).map(([id, s]) => ({
        id,
        name: s.name,
        flow: flow(`${s.path} ${s.name}`),
        kind: (s.captureRoute ? 'route' : 'component') as Screen['kind'],
        defaultScreen: false,
        route:
            s.captureRoute?.route ??
            (s.captureRoute && FIXTURES[s.captureRoute.fixture]?.route) ??
            `/dev/surfaces?s=${id}`,
        fixture: s.captureRoute?.fixture ?? s.shotFixture ?? 'profile-edit',
        clicks: s.shotClick ? [s.shotClick] : [],
        clickTestIds: s.shotClickTestId ? [s.shotClickTestId] : [],
        source: s.path,
        camera: s.camera,
        sessionStorage: s.sessionStorage,
        requiresSource: s.captureRoute && FIXTURES[s.captureRoute.fixture]?.capture?.requiresSource,
        captureState: s.captureState,
        expectSelector: s.expectSelector,
        expectsLoading: s.expectsLoading ?? false,
        event: s.captureRoute?.event,
        unavailable: s.captureRoute ? undefined : s.blocked,
    })),
]
const flowOrder = [
    'Setup and login',
    'Home and shared states',
    'Verification',
    'Add money',
    'Card',
    'Payments',
    'Withdraw',
    'Rewards',
    'Profile and settings',
]
const setupJourney: Record<string, { journey: string; step: number }> = {
    '01-a-landing': { journey: 'Account setup', step: 10 },
    '04-b-advantage-fees': { journey: 'Account setup', step: 20 },
    '02-b-advantage-card': { journey: 'Account setup', step: 30 },
    '03-a-residence-select': { journey: 'Account setup', step: 40 },
    '03-b-residence-compare': { journey: 'Account setup', step: 50 },
    '03-c-residence-congrats': { journey: 'Account setup', step: 60 },
    '03-h-funding-methods': { journey: 'Account setup', step: 70 },
    '03-i-payment-methods': { journey: 'Account setup', step: 80 },
    '06-a-signup': { journey: 'Account setup', step: 90 },
    '06-b-invite': { journey: 'Account setup', step: 100 },
    '06-c-passkey': { journey: 'Account setup', step: 110 },
    '08-a-passkeysetuphelpmodal': { journey: 'Account setup', step: 120 },
    '07-c-notification-email': { journey: 'Account setup', step: 140 },
    '07-d-notification-settings': { journey: 'Account setup', step: 150 },
    '07-b-advantage-control': { journey: 'Account setup', step: 160 },
    '05-a-signtesttransaction': { journey: 'Account setup', step: 170 },
    '05-b-signtesttransaction-network-busy': { journey: 'Account setup', step: 180 },
    '07-e-setup-celebration': { journey: 'Account setup', step: 190 },
    '20-a-setupnotificationsmodal': { journey: 'Account setup', step: 200 },
    'fixture-guest-invite': { journey: 'Invite entry', step: 210 },
    'p68-invite': { journey: 'Invite entry', step: 220 },
    '10-a-confirminvitemodal': { journey: 'Invite entry', step: 230 },
    '13-a-guestloginmodal': { journey: 'Invite entry', step: 240 },
    '14-a-guestverificationmodal': { journey: 'Invite entry', step: 250 },
    '15-a-invitefriendsmodal': { journey: 'Invite entry', step: 260 },
}
const orderedDefinitions = definitions
    .map((screen, catalogueIndex) => {
        const journey = setupJourney[screen.id]
        const screenFlow = journey?.journey === 'Account setup' ? 'Setup and login' : screen.flow
        const flowIndex = flowOrder.indexOf(screenFlow)
        return {
            ...screen,
            flow: screenFlow,
            ...(journey ? { journey: journey.journey } : {}),
            order:
                (flowIndex === -1 ? flowOrder.length : flowIndex) * 10_000 + (journey?.step ?? 1_000 + catalogueIndex),
        }
    })
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))

const BASE_SCREENS = orderedDefinitions.map((screen) => ({
    ...screen,
    expectedHttpStatus: screen.expectedHttpStatus ?? 200,
    unavailable: screen.unavailable ?? (FIXTURES[screen.fixture] ? undefined : `Unknown fixture ${screen.fixture}`),
}))
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-')
/** Each flag variant sits right after the screen it varies. */
export const SCREENS = BASE_SCREENS.flatMap((screen) => [
    screen,
    ...FLAG_VARIANTS.filter((variant) => variant.base === screen.id).map(({ flag, value }) => ({
        ...screen,
        id: `${screen.id}-flag-${slug(flag)}-${slug(String(value))}`,
        name: `${screen.name} · ${flag}: ${String(value)}`,
        defaultScreen: false,
        flags: { [flag]: value } as Record<string, boolean | string>,
    })),
])
if (new Set(SCREENS.map((s) => s.id)).size !== SCREENS.length) throw new Error('Duplicate screen IDs')
