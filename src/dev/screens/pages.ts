// Route checkpoints shared by ds-shots and the versioned library.
import { OPEN_DIALOG, HOME_ADD_DRAWER_CHECKPOINT, type CaptureRecipe } from '../fixtures/types'
export { HOME_ADD_DRAWER_CHECKPOINT }

export type PageCapture = CaptureRecipe & {
    id: string
    name: string
    route: string
    /** Fixture to serve this capture. Defaults to FIXTURE (the demo baseline). */
    fixture?: string
    entryRoute?: string
    expectedHttpStatus?: number | number[]
    routePattern?: string
    /** Accessible names clicked in order before the shot. */
    clicks?: string[]
    /** Scroll to the bottom first — some notifications sit below the fold. */
    toBottom?: boolean
    /** Canonical page after navigation, even when navigation needs setup actions. */
    defaultScreen?: boolean
}

export const PAGE_CAPTURES: PageCapture[] = [
    // The page you flagged, then each of its three inline FAQ sheets.
    { id: 'p01-backup', name: 'Backup', route: '/profile/backup' },
    {
        id: 'p02-backup-lose-phone',
        defaultScreen: false,
        name: 'Backup — What if I lose my phone?',
        route: '/profile/backup',
        actions: [{ clickSelector: '[data-testid="backup-lose-phone"]' }],
        expectSelector: '[role="dialog"][data-state="open"]',
    },
    {
        id: 'p03-backup-change-phone',
        defaultScreen: false,
        name: 'Backup — What if I change phone?',
        route: '/profile/backup',
        actions: [{ clickSelector: '[data-testid="backup-change-phone"]' }],
        expectSelector: '[role="dialog"][data-state="open"]',
    },
    {
        id: 'p04-backup-export-keys',
        defaultScreen: false,
        name: 'Backup — Why can’t I export my private key?',
        route: '/profile/backup',
        actions: [{ clickSelector: '[data-testid="backup-export-keys"]' }],
        expectSelector: '[role="dialog"][data-state="open"]',
    },

    { id: 'p05-home', name: 'Home', route: '/home' },
    { id: 'p06-profile', name: 'Settings', route: '/settings' },
    {
        id: 'p07-profile-edit',
        name: 'Profile details - email settings',
        route: '/settings/details',
        actions: [{ clickSelector: '[data-testid="profile-email-settings"]' }],
        expectSelector: '[data-testid="profile-email-settings"][aria-expanded="true"]',
    },
    { id: 'p08-profile-view', name: 'Profile — public view', route: '/profile/view?username=demo' },
    { id: 'p09-profile-about', name: 'Profile — about', route: '/profile/about' },
    {
        id: 'p10-exchange-rate',
        name: 'Exchange rate & fees',
        route: '/profile/exchange-rate',
        fixture: 'profile-exchange-rate',
    },

    // ids kept from before the 2026-09-25 split, so the screen library keeps each history
    { id: 'p11-identity-verification', name: 'Accounts', route: '/profile/accounts' },
    {
        id: 'p12-identity-additional',
        name: 'Accounts — additional verification',
        route: '/profile/accounts/additional',
    },
    { id: 'p13-limits', name: 'Limits', route: '/limits' },

    { id: 'p14-withdraw', name: 'Withdraw', route: '/withdraw' },
    { id: 'p15-withdraw-crypto', name: 'Withdraw — crypto', route: '/withdraw/crypto?amount=50' },
    { id: 'p16-withdraw-manteca', name: 'Withdraw — Manteca', route: '/withdraw/manteca?country=argentina&amount=50' },
    { id: 'p17-add-money', name: 'Add money', route: '/add-money?method=bank' },
    {
        id: 'add-money-method-picker',
        name: 'Add money — method picker',
        route: '/add-money',
        entryRoute: '/home',
        fixture: 'add-money-picker-first-time',
        // Home's Add action, not the checklist row: capture shows the demo wallet
        // balance whatever the fixture's `balance` says, so the row reads "Money
        // received", is done and does not open anything. For a first-time user the
        // Add action links straight to this picker.
        actions: [{ clickSelector: '[data-testid="home-submenu-add"]' }],
        expectSelector: '[data-testid="add-money-method-crypto"]',
        defaultScreen: true,
    },
    {
        id: 'add-money-account-currencies',
        name: 'Add money — bank account currencies',
        route: '/add-money/options?method=account',
        fixture: 'add-money-picker-first-time',
        expectSelector: '[data-testid="deposit-account-SEPA_EU"]',
    },
    { id: 'p18-add-money-crypto', name: 'Add money — crypto', route: '/add-money/crypto' },
    {
        id: 'add-money-crypto-euro-token-network',
        name: 'Add money — euro token network tooltip',
        route: '/add-money/crypto?network=EVM',
        // the chip names the credited variant, as the deposit token list does (rhino.consts EURe v2)
        actions: [{ tapSelector: '[data-testid="deposit-token-EURe v2-Gnosis"]' }],
        expectSelector: '[role="tooltip"]',
    },
    {
        id: 'add-money-crypto-token-network',
        name: 'Add money — network-specific token tooltip',
        route: '/add-money/crypto?network=EVM',
        actions: [{ tapSelector: '[data-testid="deposit-token-USDS-Base"]' }],
        expectSelector: '[role="tooltip"]',
    },
    { id: 'p19-add-money-us-bank', name: 'Add money — US bank', route: '/add-money/usa/bank' },

    { id: 'p20-qr-pay', name: 'QR Pay', route: '/qr-pay' },
    { id: 'p22-card', name: 'Card', route: '/card' },
    { id: 'p23-card-limit', name: 'Card — limit', route: '/card/limit' },
    { id: 'p24-card-pin', name: 'Card — PIN', route: '/card/pin' },
    { id: 'p25-card-recovery', name: 'Card recovery', route: '/card-recovery' },

    { id: 'p26-recover-funds', name: 'Recover funds', route: '/recover-funds' },
    { id: 'p27-recover-wallet', name: 'Recover wallet', route: '/recover-wallet' },
    { id: 'p28-history', name: 'History', route: '/history' },
    { id: 'p29-badges', name: 'Badges', route: '/badges' },
    { id: 'p31-send', name: 'Send', route: '/send' },
    { id: 'p32-request', name: 'Request', route: '/request' },
    { id: 'p33-claim', name: 'Claim', route: '/claim' },
    { id: 'p34-language', name: 'Language', route: '/settings/language' },
    { id: 'p35-home-ctas', defaultScreen: false, name: 'Home CTAs (incl. spend chooser)', route: '/dev/home-ctas' },

    // Screens the demo baseline gates out; each has a fixture that opens it.
    {
        id: 'p36-add-money-bank-list',
        defaultScreen: false,
        name: 'Add money — bank country list',
        route: '/add-money?method=bank',
        fixture: 'add-money',
    },
    {
        id: 'p37-add-money-crypto',
        defaultScreen: false,
        name: 'Add money — network picker',
        route: '/add-money/crypto',
        fixture: 'add-money-crypto',
    },
    {
        id: 'p38-kyc-action-required',
        defaultScreen: false,
        name: 'Accounts — verification action required',
        route: '/profile/accounts',
        fixture: 'kyc-action-required',
    },
    {
        id: 'p39-language',
        defaultScreen: false,
        name: 'Language',
        route: '/settings/language',
        fixture: 'settings-language',
    },
    {
        id: 'p40-withdraw',
        defaultScreen: false,
        name: 'Withdraw — saved accounts',
        route: '/withdraw',
        fixture: 'withdraw',
    },
    {
        id: 'p41-home-add-drawer',
        defaultScreen: false,
        name: 'Home — Add money drawer',
        route: '/home?drawer=add',
        fixture: 'home-add-drawer',
        expectSelector: HOME_ADD_DRAWER_CHECKPOINT,
    },
    {
        id: 'p42-home-send-drawer',
        defaultScreen: false,
        expectSelector: OPEN_DIALOG,
        name: 'Home — Send drawer (no mark)',
        route: '/home?drawer=send',
    },
]

PAGE_CAPTURES.push(
    { id: 'p44-card-add-to-wallet', name: 'Add card to wallet', route: '/card/add-to-wallet' },
    { id: 'p46-card-signature', name: 'Repair card signature', route: '/fix-card-signature' },
    { id: 'p47-pay-request', name: 'Pay a request', route: '/pay-request?id=synthetic-request' },
    { id: 'p52-kyc-success', name: 'Verification success', route: '/kyc/success' },
    { id: 'p53-maintenance', name: 'Maintenance', route: '/maintenance', fixture: 'full-maintenance' },
    { id: 'p55-send-recipient', name: 'Send to a recipient', route: '/send/demo' },
    { id: 'p56-request-recipient', name: 'Request from a recipient', route: '/request/demo' },
    { id: 'p57-qr-code', defaultScreen: false, name: 'QR payment — invalid code', route: '/qr/synthetic-invalid' },
    { id: 'p58-qr-success', name: 'QR code claimed successfully', route: '/qr/synthetic-success/success' },
    {
        id: 'p59-receipt',
        defaultScreen: false,
        expectedHttpStatus: [200, 404],
        name: 'Receipt — missing transaction',
        route: '/receipt/synthetic-invalid',
    },
    { id: 'p60-receipt-entry', name: 'Receipt entry', route: '/receipt' },
    { id: 'p61-bank-europe', name: 'Add money — European bank', route: '/add-money/spain/bank', fixture: 'add-money' },
    { id: 'p62-bank-us', name: 'Add money — US bank', route: '/add-money/usa/bank', fixture: 'add-money' },
    { id: 'p63-deposit-argentina', name: 'Add money — Argentina', route: '/add-money/argentina', fixture: 'add-money' },
    {
        id: 'p64-withdraw-europe',
        name: 'Withdraw — European bank',
        route: '/withdraw/spain/bank',
        defaultScreen: true,
        entryRoute: '/withdraw?amount=50',
        actions: [
            { clickSelector: '[data-testid="saved-account-fixture-iban-1"]' },
            { fill: { selector: '[data-testid="amount-input"]', value: '50' } },
            { clickSelector: '[data-testid="withdraw-amount-continue"]' },
        ],
        fixture: 'withdraw',
    },
    // p65-withdraw-argentina removed: Argentina has one live withdraw rail
    // (Manteca), so /withdraw/argentina redirects straight to /withdraw/manteca
    // (AddWithdrawCountriesList redirect, added 2026-09-16). A screenshot there
    // never settles on /withdraw/argentina, and the Manteca form it lands on is
    // already covered by p16-withdraw-manteca.
    { id: 'p67-recipient', name: 'Recipient profile', route: '/demo' },
    {
        id: 'p68-invite',
        defaultScreen: false,
        name: 'Invite — missing code',
        route: '/invite?code=synthetic-invite',
        fixture: 'guest-invite',
    },
    {
        id: 'p69-regional-deposit',
        name: 'Add money — regional method',
        route: '/add-money/argentina/manteca',
        fixture: 'add-money',
    },
    { id: 'p70-payments', name: 'Payments', route: '/profile/payments', fixture: 'profile-payments' },
    {
        id: 'p71-accounts-held',
        defaultScreen: false,
        name: 'Accounts — one held, the rest folded',
        route: '/profile/accounts',
        fixture: 'profile-accounts',
    },
    {
        id: 'p72-accounts-held-open',
        defaultScreen: false,
        name: 'Accounts — open a new account, unfolded',
        route: '/profile/accounts',
        fixture: 'profile-accounts',
        actions: [{ clickSelector: '[data-testid="open-accounts-toggle"]' }],
        expectSelector: '[data-testid="open-accounts-toggle"][aria-expanded="true"]',
    },
    {
        id: 'p73-token-selector-drawer',
        defaultScreen: false,
        name: 'Token selector — open drawer, selected token',
        route: '/withdraw/crypto',
        fixture: 'withdraw-crypto-destination',
        actions: [
            { clickSelector: '[data-testid="token-selector-trigger"]' },
            { clickSelector: '[role="dialog"] [role="option"]' },
            { clickSelector: '[data-testid="token-selector-trigger"]' },
        ],
        expectSelector: '[role="dialog"] [role="option"][aria-selected="true"]',
    },
    {
        id: 'p74-network-selector-drawer',
        defaultScreen: false,
        name: 'Network selector — open drawer, selected network',
        route: '/withdraw/crypto',
        fixture: 'withdraw-crypto-destination',
        actions: [
            { clickSelector: '[data-testid="network-selector-trigger"]' },
            { clickSelector: '[role="dialog"] [role="option"]' },
            { clickSelector: '[data-testid="network-selector-trigger"]' },
        ],
        expectSelector: '[role="dialog"] [role="option"][aria-selected="true"]',
    },
    {
        id: 'p75-residence-country-dropdown',
        defaultScreen: false,
        name: 'Residence — open country list, selected country',
        route: '/dev/surfaces?s=03-a-residence-select',
        actions: [
            { clickSelector: '[data-testid="setup-residence-country"]' },
            { clickSelector: '[role="dialog"] [role="button"][aria-label]' },
            { clickSelector: '[data-testid="setup-residence-country"]' },
        ],
        expectSelector: '[role="dialog"] [role="button"][aria-current="true"]',
    },
    {
        id: 'p77-base-select-dropdown',
        defaultScreen: false,
        name: 'BaseSelect — open dropdown, selected option',
        route: '/dev/ds/primitives/base-select',
        actions: [
            { clickSelector: 'button[role="combobox"]' },
            { clickSelector: '[role="option"]' },
            { clickSelector: 'button[role="combobox"]' },
        ],
        expectSelector: '[role="listbox"] [role="option"][aria-selected="true"]',
    },
    { id: 'p78-statements', name: 'Statements', route: '/profile/statements' },
    {
        id: 'p79-notifications',
        name: 'Notifications settings',
        route: '/settings/notifications',
        fixture: 'settings-notifications',
    },
    // Pix states that follow a tap; the fixture answers the call the tap makes.
    {
        id: 'p81-pix-deposit-limit',
        name: 'Pix deposit — over the monthly limit',
        route: '/add-money/pix?amount=100&currency=BRL',
        fixture: 'pix-deposit-amount',
        actions: [{ clickSelector: '[data-testid="deposit-amount-continue"]' }],
        expectSelector: '[role="alert"]',
    },
    {
        id: 'p84-pix-provider-sheet',
        name: "Pix review — the provider's legal details",
        // the key and amount come from the fixture's session draft, never the URL
        route: '/withdraw/pix?step=review',
        fixture: 'pix-withdraw-review',
        // the (?) is an icon: "About Avenia" is its aria-label, not text a click by text finds
        actions: [{ clickSelector: '[data-testid="provider-help"]' }],
        expectSelector: '[role="dialog"][data-state="open"]',
    },
    // Manteca's two entities, as the statement's provider page names them: Argentina's money, and Pix
    // for users who do not live in Brazil
    {
        id: 'p85-manteca-ar-provider-sheet',
        name: "Argentina's add money — the provider's legal details",
        route: '/add-money/argentina/manteca?step=inputAmount&amount=10000&currency=ARS',
        fixture: 'add-money-provider-rejected',
        actions: [{ clickSelector: '[data-testid="provider-help"]' }],
        expectSelector: '[role="dialog"][data-state="open"]',
    },
    {
        id: 'p86-pix-manteca-provider-sheet',
        name: "Pix review on Manteca's route — the provider's legal details",
        route: '/withdraw/pix?step=review',
        fixture: 'pix-manteca-withdraw-review',
        actions: [{ clickSelector: '[data-testid="provider-help"]' }],
        expectSelector: '[role="dialog"][data-state="open"]',
    },
    // the list of every currency's buy and sell rate, which replaced the exchange rate page's
    // currency dropdown (TASK-25349)
    {
        id: 'p87-exchange-rate-all-currencies',
        name: 'Exchange rate & fees — all currencies',
        route: '/profile/exchange-rate?view=all',
        fixture: 'profile-exchange-rate',
        expectSelector: '[data-testid^="currency-row-"]',
    }
)
