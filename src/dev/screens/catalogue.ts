import { FIXTURES } from '../fixtures/registry'
import { SURFACE_META } from '../surfaces/list'
import { PAGE_CAPTURES, type PageCapture } from './pages'

export type Screen = {
    id: string
    name: string
    flow: string
    kind: 'route' | 'component'
    route: string
    camera?: 'synthetic' | 'denied'
    videoFrame?: number
    sessionStorage?: Record<string, string>
    requiresSource?: string
    entryRoute?: string
    actions?: PageCapture['actions']
    routePattern?: string
    fixture: string
    clicks: string[]
    source?: string
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
        ['profile|language|avatar|support', 'Profile and settings'],
    ]
    return rules.find(([pattern]) => new RegExp(pattern, 'i').test(value))?.[1] ?? 'Home and shared states'
}
const readiness: Record<string, string> = {
    '55-d-supportdrawer': "Chat couldn't load",
    'fixture-early-user': 'Earn from invites',
    '11-a-earlyusermodal': 'Earn from invites',
    'fixture-reconsent': 'A small update to our terms',
    '18-a-reconsentmodal': 'A small update to our terms',
    '67-e-provideemailstep': 'Add your email to continue',
}
const routeOverrides: Record<
    string,
    { route: string; fixture: string; event?: Screen['event']; storage?: Record<string, string> }
> = {
    '11-a-earlyusermodal': { route: '/home', fixture: 'early-user' },
    '41-c-migrationdownloadmodal': { route: '/home', fixture: 'home', storage: { 'pwa-sunset': 'true' } },
    '57-d-raincooldownintromodal': { route: '/home', fixture: 'home', event: 'rain:cooldown' },
    '58-d-stalecardapprovalreenablemodal': { route: '/home', fixture: 'home', event: 'rain:stale-card-approval' },
    '18-a-reconsentmodal': { route: '/home', fixture: 'reconsent' },
    '51-d-homeactiondrawers': { route: '/home?drawer=add', fixture: 'home' },

    '66-e-avatarpicker': { route: FIXTURES['avatar-picker'].route, fixture: 'avatar-picker' },
}
const definitions: Screen[] = [
    {
        id: 'qr-camera-permission',
        name: 'QR scanner — camera permission needed',
        flow: 'Payments',
        kind: 'component',
        route: '/dev/surfaces?s=54-d-qrbottomdrawer',
        fixture: 'profile-edit',
        clicks: [],
        camera: 'denied',
    },
    ...Object.entries(FIXTURES).map(([id, f]) => ({
        id: `fixture-${id}`,
        name: f.about,
        flow: flow(`${id} ${f.route}`),
        kind: 'route' as const,
        route: f.route,
        fixture: id,
        clicks: [],
        // The pending application screen IS a spinner ("Setting up your
        // card…") — same carve-out as 24-b-kycverificationinprogressmodal.
        expectsLoading: id === 'card-pending',
    })),
    ...PAGE_CAPTURES.map((p) => ({
        ...p,
        flow: flow(p.route),
        kind: (p.route.startsWith('/dev/') ? 'component' : 'route') as Screen['kind'],
        fixture: p.fixture ?? 'profile-edit',
        clicks: p.clicks ?? [],
    })),
    ...Object.entries(SURFACE_META).map(([id, s]) => ({
        id,
        name: s.name,
        flow: flow(`${s.path} ${s.name}`),
        kind: (routeOverrides[id] ? 'route' : 'component') as Screen['kind'],
        route: routeOverrides[id]?.route ?? `/dev/surfaces?s=${id}`,
        fixture: routeOverrides[id]?.fixture ?? s.shotFixture ?? 'profile-edit',
        clicks: s.shotClick ? [s.shotClick] : [],
        source: s.path,
        expectsLoading: id === '24-b-kycverificationinprogressmodal',
        event: routeOverrides[id]?.event,
        storage: routeOverrides[id]?.storage,
        unavailable: routeOverrides[id] ? undefined : s.blocked,
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
    '06-a-signup': { journey: 'Account setup', step: 30 },
    '03-a-residence-select': { journey: 'Account setup', step: 40 },
    '07-a-setuppasskey': { journey: 'Account setup', step: 50 },
    '08-a-passkeysetuphelpmodal': { journey: 'Account setup', step: 51 },
    '09-a-passkeyinfomodal': { journey: 'Account setup', step: 52 },
    '05-a-signtesttransaction': { journey: 'Account setup', step: 60 },
    '20-a-setupnotificationsmodal': { journey: 'Account setup', step: 70 },
    'p51-setup-finish': { journey: 'Account setup', step: 80 },
    'fixture-setup-pending': { journey: 'Resume setup', step: 110 },
    'p50-setup-session': { journey: 'Resume setup', step: 120 },
    'fixture-guest-invite': { journey: 'Invite entry', step: 210 },
    'p68-invite': { journey: 'Invite entry', step: 220 },
    '10-a-confirminvitemodal': { journey: 'Invite entry', step: 230 },
    '13-a-guestloginmodal': { journey: 'Invite entry', step: 240 },
    '14-a-guestverificationmodal': { journey: 'Invite entry', step: 250 },
    '15-a-invitefriendsmodal': { journey: 'Invite entry', step: 260 },
}
const orderedDefinitions = definitions
    .map((screen, catalogueIndex) => {
        const flowIndex = flowOrder.indexOf(screen.flow)
        const journey = setupJourney[screen.id]
        return {
            ...screen,
            ...(journey ? { journey: journey.journey } : {}),
            order:
                (flowIndex === -1 ? flowOrder.length : flowIndex) * 10_000 + (journey?.step ?? 1_000 + catalogueIndex),
        }
    })
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))

export const SCREENS = orderedDefinitions.map((screen) => ({
    ...screen,
    sessionStorage: screen.id === '17-a-nomorejailmodal' ? { showNoMoreJailModal: 'true' } : undefined,
    expectText: screen.id === 'qr-camera-permission' ? 'Camera access needed' : readiness[screen.id],
    camera: screen.id === '54-d-qrbottomdrawer' ? ('synthetic' as const) : screen.camera,
    requiresSource: ['fixture-avatar-picker', '66-e-avatarpicker'].includes(screen.id)
        ? 'src/components/Avatar/AvatarPicker.tsx'
        : undefined,
    expectedHttpStatus: screen.id === 'p59-receipt' ? [200, 404] : 200,
}))
if (new Set(SCREENS.map((s) => s.id)).size !== SCREENS.length) throw new Error('Duplicate screen IDs')
