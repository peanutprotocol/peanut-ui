// Route checkpoints shared by ds-shots and the versioned library.
export type PageCapture = {
    id: string
    name: string
    route: string
    /** Fixture to serve this capture. Defaults to FIXTURE (the demo baseline). */
    fixture?: string
    entryRoute?: string
    actions?: Array<{ click: string } | { fill: { selector: string; value: string } }>
    routePattern?: string
    exclusion?: string
    /** Accessible names clicked in order before the shot. */
    clicks?: string[]
    /** Scroll to the bottom first — some notifications sit below the fold. */
    toBottom?: boolean
}

export const PAGE_CAPTURES: PageCapture[] = [
    // The page you flagged, then each of its three inline FAQ sheets.
    { id: 'p01-backup', name: 'Backup', route: '/profile/backup' },
    {
        id: 'p02-backup-lose-phone',
        name: 'Backup — What if I lose my phone?',
        route: '/profile/backup',
        clicks: ['What if I lose my phone?'],
    },
    {
        id: 'p03-backup-change-phone',
        name: 'Backup — What if I change phone?',
        route: '/profile/backup',
        clicks: ['What if I change phone?'],
    },
    {
        id: 'p04-backup-export-keys',
        name: 'Backup — Why can’t I export my private key?',
        route: '/profile/backup',
        clicks: ["Why can't I export my private key?"],
    },

    { id: 'p05-home', name: 'Home', route: '/home' },
    { id: 'p06-profile', name: 'Profile', route: '/profile' },
    { id: 'p07-profile-edit', name: 'Profile — edit', route: '/profile/edit' },
    { id: 'p08-profile-view', name: 'Profile — public view', route: '/profile/view?username=demo' },
    { id: 'p09-profile-about', name: 'Profile — about', route: '/profile/about' },
    { id: 'p10-exchange-rate', name: 'Exchange rate', route: '/profile/exchange-rate' },

    { id: 'p11-identity-verification', name: 'Identity verification', route: '/profile/identity-verification' },
    {
        id: 'p12-identity-additional',
        name: 'Identity — additional',
        route: '/profile/identity-verification/additional',
    },
    { id: 'p13-limits', name: 'Limits', route: '/limits' },

    { id: 'p14-withdraw', name: 'Withdraw', route: '/withdraw' },
    { id: 'p15-withdraw-crypto', name: 'Withdraw — crypto', route: '/withdraw/crypto?amount=50' },
    { id: 'p16-withdraw-manteca', name: 'Withdraw — Manteca', route: '/withdraw/manteca?country=argentina&amount=50' },
    { id: 'p17-add-money', name: 'Add money', route: '/add-money?method=bank' },
    { id: 'p18-add-money-crypto', name: 'Add money — crypto', route: '/add-money/crypto' },
    { id: 'p19-add-money-us-bank', name: 'Add money — US bank', route: '/add-money/usa/bank' },

    { id: 'p20-qr-pay', name: 'QR Pay', route: '/qr-pay' },
    {
        id: 'p21-qr',
        exclusion: 'Native query-route stub; app-owned QR drawer is captured separately, native shell routing is v2',
        name: 'QR',
        route: '/qr',
    },
    { id: 'p22-card', name: 'Card', route: '/card' },
    { id: 'p23-card-limit', name: 'Card — limit', route: '/card/limit' },
    { id: 'p24-card-pin', name: 'Card — PIN', route: '/card/pin' },
    { id: 'p25-card-recovery', name: 'Card recovery', route: '/card-recovery' },

    { id: 'p26-recover-funds', name: 'Recover funds', route: '/recover-funds' },
    { id: 'p27-recover-wallet', name: 'Recover wallet', route: '/recover-wallet' },
    { id: 'p28-history', name: 'History', route: '/history' },
    { id: 'p29-badges', name: 'Badges', route: '/badges' },
    {
        id: 'p30-points',
        exclusion: 'Legacy entry redirects to Rewards; the Rewards fixtures cover this UI',
        name: 'Points',
        route: '/points',
    },
    { id: 'p31-send', name: 'Send', route: '/send' },
    { id: 'p32-request', name: 'Request', route: '/request' },
    { id: 'p33-claim', name: 'Claim', route: '/claim' },
    { id: 'p34-language', name: 'Language', route: '/settings/language' },
    { id: 'p35-home-ctas', name: 'Home CTAs (incl. spend chooser)', route: '/dev/home-ctas' },

    // Screens the demo baseline gates out; each has a fixture that opens it.
    {
        id: 'p36-add-money-bank-list',
        name: 'Add money — bank country list',
        route: '/add-money?method=bank',
        fixture: 'add-money',
    },
    {
        id: 'p37-add-money-crypto',
        name: 'Add money — network picker',
        route: '/add-money/crypto',
        fixture: 'add-money-crypto',
    },
    {
        id: 'p38-kyc-action-required',
        name: 'Identity — action required',
        route: '/profile/identity-verification',
        fixture: 'kyc-action-required',
    },
    { id: 'p39-language', name: 'Language', route: '/settings/language', fixture: 'settings-language' },
    { id: 'p40-withdraw', name: 'Withdraw — saved accounts', route: '/withdraw', fixture: 'withdraw' },
    { id: 'p41-home-add-drawer', name: 'Home — Add money drawer', route: '/home?drawer=add' },
    { id: 'p42-home-send-drawer', name: 'Home — Send drawer (no mark)', route: '/home?drawer=send' },
]

PAGE_CAPTURES.push(
    { id: 'p43-card-physical', name: 'Physical card', route: '/card/physical' },
    { id: 'p44-card-add-to-wallet', name: 'Add card to wallet', route: '/card/add-to-wallet' },
    {
        id: 'p45-card-payment',
        exclusion: 'Routing-only card payment handoff; no standalone product screen',
        name: 'Card payment',
        route: '/card-payment',
    },
    { id: 'p46-card-signature', name: 'Repair card signature', route: '/fix-card-signature' },
    { id: 'p47-pay-request', name: 'Pay a request', route: '/pay-request?id=synthetic-request' },
    {
        id: 'p48-points-invites',
        exclusion: 'Legacy entry redirects to Rewards invites; covered by the Rewards invites fixture',
        name: 'Points and invites',
        route: '/points/invites',
    },
    {
        id: 'p49-request-pay',
        exclusion: 'Routing-only request link resolver; request and payment screens are captured separately',
        name: 'Request payment',
        route: '/request/pay',
    },
    { id: 'p50-setup-session', name: 'Setup — existing session', route: '/setup', fixture: 'setup-pending' },
    { id: 'p51-setup-finish', name: 'Setup completion', route: '/setup/finish', fixture: 'setup-pending' },
    { id: 'p52-kyc-success', name: 'Verification success', route: '/kyc/success' },
    { id: 'p53-maintenance', name: 'Maintenance', route: '/maintenance' },
    {
        id: 'p54-pay-recipient',
        exclusion: 'Legacy pay URL redirects to the send-recipient screen captured by p55',
        name: 'Pay a recipient',
        route: '/pay/demo',
    },
    { id: 'p55-send-recipient', name: 'Send to a recipient', route: '/send/demo' },
    { id: 'p56-request-recipient', name: 'Request from a recipient', route: '/request/demo' },
    { id: 'p57-qr-code', name: 'QR payment — invalid code', route: '/qr/synthetic-invalid' },
    { id: 'p58-qr-success', name: 'QR code claimed successfully', route: '/qr/synthetic-success/success' },
    { id: 'p59-receipt', name: 'Receipt — missing transaction', route: '/receipt/synthetic-invalid' },
    { id: 'p60-receipt-entry', name: 'Receipt entry', route: '/receipt' },
    { id: 'p61-bank-europe', name: 'Add money — European bank', route: '/add-money/spain/bank', fixture: 'add-money' },
    { id: 'p62-bank-us', name: 'Add money — US bank', route: '/add-money/usa/bank', fixture: 'add-money' },
    { id: 'p63-deposit-argentina', name: 'Add money — Argentina', route: '/add-money/argentina', fixture: 'add-money' },
    {
        id: 'p64-withdraw-europe',
        name: 'Withdraw — European bank',
        route: '/withdraw/spain/bank',
        entryRoute: '/withdraw?amount=50',
        actions: [
            { click: 'ES27' },
            { fill: { selector: 'input[inputmode=decimal]', value: '50' } },
            { click: 'Continue' },
        ],
        fixture: 'withdraw',
    },
    { id: 'p65-withdraw-argentina', name: 'Withdraw — Argentina', route: '/withdraw/argentina', fixture: 'withdraw' },
    {
        id: 'p66-bank-local',
        exclusion: 'Argentina bank deposits use the regional Manteca route captured by p69',
        name: 'Add money — local bank',
        route: '/add-money/argentina/bank',
        fixture: 'add-money',
    },
    { id: 'p67-recipient', name: 'Recipient profile', route: '/demo' },
    {
        id: 'p68-invite',
        name: 'Invite — missing code',
        route: '/invite?code=synthetic-invite',
        fixture: 'guest-invite',
    },
    {
        id: 'p69-regional-deposit',
        name: 'Add money — regional method',
        route: '/add-money/argentina/manteca',
        fixture: 'add-money',
    }
)

PAGE_CAPTURES.push(
    {
        id: 'h01-notifications',
        name: 'Notifications — empty inbox',
        route: '/notifications',
        routePattern: '/notifications',
    },
    { id: 'h02-settings', name: 'Settings — logout', route: '/settings', routePattern: '/settings' }
)
