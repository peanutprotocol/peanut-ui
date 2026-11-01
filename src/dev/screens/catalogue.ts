import { FIXTURES } from '../fixtures/registry'
import { SURFACE_META } from '../surfaces/list'
import { PAGE_CAPTURES, type PageCapture } from './pages'

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
    '67-e-provideemailstep': 'Add email to continue',
    '89-f-withdraw-review-insufficient': 'Not enough balance. Add funds to continue.',
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
// Page captures that deliberately show a second state of another page. Keep this
// list explicit: a fixture can also be necessary to reach a canonical page.
const variationPageIds = new Set([
    'p02-backup-lose-phone',
    'p03-backup-change-phone',
    'p04-backup-export-keys',
    'p35-home-ctas',
    'p36-add-money-bank-list',
    'p37-add-money-crypto',
    'p38-kyc-action-required',
    'p39-language',
    'p40-withdraw',
    'p41-home-add-drawer',
    'p42-home-send-drawer',
    'p57-qr-code',
    'p59-receipt',
    'p68-invite',
    'p71-accounts-held',
    'p72-accounts-held-open',
    'p73-token-selector-drawer',
    'p74-network-selector-drawer',
    'p75-residence-country-dropdown',
    'p76-exchange-currency-dropdown',
    'p77-base-select-dropdown',
])
const definitions: Screen[] = [
    {
        id: 'qr-camera-permission',
        name: 'QR scanner — camera permission needed',
        flow: 'Payments',
        kind: 'component',
        defaultScreen: false,
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
        defaultScreen: false,
        route: f.landsOn ?? f.route,
        entryRoute: f.landsOn ? f.route : undefined,
        fixture: id,
        clicks: [],
        actions:
            // ready shows the consent screen and on passes through; the other states answer the tap
            /^feature-activation-(bank|local)-/.test(id) && !/-(ready|on)$/.test(id)
                ? [{ clickSelector: '[data-testid="kyc-activation-continue"]' }]
                : undefined,
        expectSelector: id.startsWith('paperwork-verification-state-')
            ? '[data-testid="verify-input-state"]'
            : id.startsWith('paperwork-verification-closed-')
              ? '[data-testid="verify-closed-features"]'
              : id === 'paperwork-verification-outage'
                ? '[data-testid="verify-outage"]'
                : id === 'paperwork-verification-policy-hold'
                  ? '[data-testid="verify-review-retry"]'
                  : id === 'paperwork-verification-rejected'
                    ? '[data-testid="verify-review-home"]'
                    : id === 'paperwork-verification-restart-foreign'
                      ? '[data-testid="verify-id"]'
                      : undefined,
        expectsLoading: f.isLoadingState || id === 'card-pending',
    })),
    ...PAGE_CAPTURES.map((p) => ({
        ...p,
        flow: flow(p.route),
        kind: (p.route.startsWith('/dev/') ? 'component' : 'route') as Screen['kind'],
        defaultScreen:
            p.defaultScreen ??
            (!p.route.startsWith('/dev/') &&
                !p.route.includes('drawer=') &&
                !variationPageIds.has(p.id) &&
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
        kind: (routeOverrides[id] ? 'route' : 'component') as Screen['kind'],
        defaultScreen: false,
        route: routeOverrides[id]?.route ?? `/dev/surfaces?s=${id}`,
        fixture: routeOverrides[id]?.fixture ?? s.shotFixture ?? 'profile-edit',
        clicks: s.shotClick ? [s.shotClick] : [],
        clickTestIds: s.shotClickTestId ? [s.shotClickTestId] : [],
        source: s.path,
        captureState: s.captureState,
        expectSelector: s.expectSelector,
        expectsLoading: ['24-b-kycverificationinprogressmodal', '90-f-withdraw-review-processing'].includes(id),
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
    '06-b-invite': { journey: 'Account setup', step: 20 },
    '06-a-signup': { journey: 'Account setup', step: 30 },
    '08-a-passkeysetuphelpmodal': { journey: 'Account setup', step: 31 },
    '09-a-passkeyinfomodal': { journey: 'Account setup', step: 32 },
    '03-a-residence-select': { journey: 'Account setup', step: 40 },
    '03-b-residence-compare': { journey: 'Account setup', step: 41 },
    '04-b-advantage-fees': { journey: 'Account setup', step: 42 },
    '02-b-advantage-card': { journey: 'Account setup', step: 44 },
    '03-c-residence-congrats': { journey: 'Account setup', step: 46 },
    '03-h-funding-methods': { journey: 'Account setup', step: 47 },
    '03-i-payment-methods': { journey: 'Account setup', step: 48 },
    '07-c-notification-email': { journey: 'Account setup', step: 53 },
    '07-d-notification-settings': { journey: 'Account setup', step: 54 },
    '07-b-advantage-control': { journey: 'Account setup', step: 55 },
    '05-a-signtesttransaction': { journey: 'Account setup', step: 60 },
    '07-e-setup-celebration': { journey: 'Account setup', step: 65 },
    '20-a-setupnotificationsmodal': { journey: 'Account setup', step: 70 },
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

export const SCREENS = orderedDefinitions.map((screen) => ({
    ...screen,
    sessionStorage: screen.id === '17-a-nomorejailmodal' ? { showNoMoreJailModal: 'true' } : undefined,
    expectText: screen.id === 'qr-camera-permission' ? 'Camera access needed' : readiness[screen.id],
    expectSelector:
        screen.expectSelector ??
        // The QR drawer intentionally rests at a small peek snap. Its visible
        // title proves it is open without requiring half its full-height box.
        (screen.id === '54-d-qrbottomdrawer' ? '[role="dialog"][data-state="open"] h2' : undefined) ??
        (/Drawer\b/.test(screen.name) || screen.route.includes('drawer=')
            ? '[role="dialog"]:not([aria-modal="false"])'
            : undefined),
    camera: screen.id === '54-d-qrbottomdrawer' ? ('synthetic' as const) : screen.camera,
    requiresSource: ['fixture-avatar-picker', '66-e-avatarpicker'].includes(screen.id)
        ? 'src/components/Avatar/AvatarPicker.tsx'
        : undefined,
    expectedHttpStatus: screen.id === 'p59-receipt' ? [200, 404] : 200,
}))
if (new Set(SCREENS.map((s) => s.id)).size !== SCREENS.length) throw new Error('Duplicate screen IDs')
