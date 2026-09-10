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
}
const flow = (value: string): string => {
    const rules = [
        ['setup|landing|passkey|signup|residence|install|guest|invite', 'Setup and login'],
        ['kyc|identity|consent|email|bridgetos|reject', 'Verification'],
        ['card|rain', 'Card'],
        ['add.money|onramp|deposit', 'Add money'],
        ['withdraw|recover', 'Withdraw'],
        ['send|claim|request|qr|contribut|transaction', 'Payments'],
        ['badge|reward|points|perk', 'Rewards'],
        ['profile|language|avatar|support', 'Profile and settings'],
    ]
    return rules.find(([pattern]) => new RegExp(pattern, 'i').test(value))?.[1] ?? 'Home and shared states'
}
const readiness: Record<string, string> = {
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
        fixture: routeOverrides[id]?.fixture ?? 'profile-edit',
        clicks: [],
        source: s.path,
        expectsLoading: id === '24-b-kycverificationinprogressmodal',
        event: routeOverrides[id]?.event,
        storage: routeOverrides[id]?.storage,
        unavailable: routeOverrides[id] ? undefined : s.blocked,
    })),
]
export const SCREENS = definitions.map((screen) => ({
    ...screen,
    expectText: screen.id === 'qr-camera-permission' ? 'Camera access needed' : readiness[screen.id],
    camera: screen.id === '54-d-qrbottomdrawer' ? ('synthetic' as const) : screen.camera,
    requiresSource: ['fixture-avatar-picker', '66-e-avatarpicker'].includes(screen.id)
        ? 'src/components/Avatar/AvatarPicker.tsx'
        : undefined,
    expectedHttpStatus: screen.id === 'p59-receipt' ? [200, 404] : 200,
}))
if (new Set(SCREENS.map((s) => s.id)).size !== SCREENS.length) throw new Error('Duplicate screen IDs')
