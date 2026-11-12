import { type Concept } from '@/components/0_Bruddle/conceptIcons'
import { PIX_ADD_MONEY_PATH } from '@/features/pix/pix.routes'
import { type HomeDrawer } from './useHomeDrawer'

export type HomeDrawerKey = 'sendToFriends' | 'withdrawToOwnAccounts' | 'shareRequestLink' | 'shareBankDetails'
type HomeDrawerBodyKey =
    | 'sendToFriendsDescription'
    | 'withdrawToOwnAccountsDescription'
    | 'shareRequestLinkDescription'
    | 'shareBankDetailsDescription'
export type AddMethodKey = 'pix' | 'bankTransfer' | 'crypto'
type AddMethodBodyKey = 'pixDescription' | 'bankTransferDescription' | 'cryptoDescription'

export interface DrawerOption {
    key: string
    /** i18n namespace + key — 'drawers' = home.drawers, 'methods' = addMoney.methods */
    titleKey: ['drawers', HomeDrawerKey] | ['methods', AddMethodKey]
    bodyKey?: ['drawers', HomeDrawerBodyKey] | ['methods', AddMethodBodyKey]
    /** the row's icon and bubble colour come from the concept map, as on the Send page (SendRouter) */
    concept: Concept
    href: string
    /**
     * What the tap reports as `deposit_method_selected`. The bank rows report nothing here: both
     * land on the country list, whose click is the one place the bank arm is reported.
     */
    depositSelected?: { method_type: 'pix'; country: 'brazil' }
}

// send drawer board 17831:79186; add drawer board 17830:76839. withdraw is
// reachable from home through the SEND drawer only (product ruling 2026-08-21:
// the add drawer is bank transfer + crypto, per the board's visible items).
const BANK_ONE_OFF: DrawerOption = {
    key: 'bank',
    titleKey: ['methods', 'bankTransfer'],
    concept: 'bank',
    href: '/add-money?method=bank',
}

/**
 * Pix leads the Add drawer for a user whose Pix deposit route is open (Aleks, 2026-11-12): a route
 * the API sent and did not refuse (`pixRouteOpen`), paused included, since the Pix page shows the
 * outage itself. The BRL row then leaves the bank lists (`useBankRows`). The row lands on the Pix
 * page straight away, so its tap is where the Pix arm of `deposit_method_selected` is reported.
 */
const PIX: DrawerOption = {
    key: 'pix',
    titleKey: ['methods', 'pix'],
    bodyKey: ['methods', 'pixDescription'],
    concept: 'pix',
    href: PIX_ADD_MONEY_PATH,
    depositSelected: { method_type: 'pix', country: 'brazil' },
}

const DRAWER_OPTIONS: Record<HomeDrawer, DrawerOption[]> = {
    send: [
        {
            key: 'send-friends',
            titleKey: ['drawers', 'sendToFriends'],
            bodyKey: ['drawers', 'sendToFriendsDescription'],
            // friends = several people; the withdraw row below takes the
            // withdraw concept (arrow up, the mirror of add money's arrow down).
            concept: 'friends',
            href: '/send',
        },
        {
            key: 'withdraw',
            titleKey: ['drawers', 'withdrawToOwnAccounts'],
            bodyKey: ['drawers', 'withdrawToOwnAccountsDescription'],
            concept: 'withdraw',
            href: '/withdraw',
        },
    ],
    add: [
        // bank before crypto (2026-09-18 decision, per product/activation-funnel.md):
        // most users already have a bank account, so bank leads and crypto —
        // the KYC-free path — is the second option. For a user with a Pix
        // deposit route, Pix leads them both (Aleks, 2026-11-12): `addOptions`.
        BANK_ONE_OFF,
        {
            key: 'crypto',
            titleKey: ['methods', 'crypto'],
            bodyKey: ['methods', 'cryptoDescription'],
            concept: 'crypto',
            href: '/add-money/crypto',
        },
    ],
    // Two ways to be paid. A request link asks one person for one amount and is
    // answered inside Peanut; standing bank details take any amount from anybody
    // straight into the requester's account, with no link. The bank row is added
    // in `requestOptions` only where the provider will open an account.
    request: [
        {
            key: 'share-link',
            titleKey: ['drawers', 'shareRequestLink'],
            bodyKey: ['drawers', 'shareRequestLinkDescription'],
            concept: 'requestLink',
            href: '/request',
        },
    ],
}

// The standing bank details row, reachable only when the get-paid flow is open
// for business: the same `/add-money?method=bank` country entry the Add drawer
// uses, which lands on the deposit-account details + share screen.
const SHARE_BANK_DETAILS: DrawerOption = {
    key: 'share-bank',
    titleKey: ['drawers', 'shareBankDetails'],
    bodyKey: ['drawers', 'shareBankDetailsDescription'],
    concept: 'bank',
    href: '/add-money?method=bank',
}

function requestOptions(depositAccountsEnabled: boolean): DrawerOption[] {
    return depositAccountsEnabled ? [...DRAWER_OPTIONS.request, SHARE_BANK_DETAILS] : DRAWER_OPTIONS.request
}

/**
 * The bank row, before and after get-paid launches.
 *
 * Both end in bank details. The standing account is reusable, takes any amount
 * and needs no reference, so it is the better answer to "how do I get money in
 * by bank" — but only where the provider will actually open one, which is why
 * it waits on the `deposit-accounts` flag. Until then the row promises less.
 *
 * Both rows lead to the same place. The country selector is the single entry
 * to every bank route: it already reads the rail catalogue and sends a country
 * to its standing account, its top-up flow, or the waitlist. A second entry
 * that skipped the country step could only serve the corridors it knew about.
 */
/*
 * Both bank rows land on the country list, and the country click is the one
 * place `deposit_method_selected` reports the bank arm. A second capture here
 * counted the same user twice as soon as the flag went on.
 */
const BANK_STANDING: DrawerOption = {
    key: 'bank',
    titleKey: ['methods', 'bankTransfer'],
    bodyKey: ['methods', 'bankTransferDescription'],
    concept: 'bank',
    href: '/add-money?method=bank',
}

function addOptions(depositAccountsEnabled: boolean, pixOpen: boolean): DrawerOption[] {
    const options = DRAWER_OPTIONS.add.map((option) =>
        option.key === 'bank' && depositAccountsEnabled ? BANK_STANDING : option
    )
    return pixOpen ? [PIX, ...options] : options
}

/**
 * The rows a home drawer shows. The home submenu reads the same list: a drawer
 * that would hold one row is an extra tap, so the submenu links straight to
 * that row's destination instead. `pixOpen`: the user's Pix deposit route is
 * open (`usePixDepositOpen`).
 */
export function homeDrawerOptions(
    drawer: HomeDrawer,
    depositAccountsEnabled: boolean,
    pixOpen: boolean
): DrawerOption[] {
    if (drawer === 'add') return addOptions(depositAccountsEnabled, pixOpen)
    if (drawer === 'request') return requestOptions(depositAccountsEnabled)
    return DRAWER_OPTIONS[drawer]
}
