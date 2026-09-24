import { type IconBubbleColor } from '@/components/0_Bruddle/IconBubble'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import { type IconName } from '@/components/Global/Icons/Icon'
import { type HomeDrawer } from './useHomeDrawer'

export type HomeDrawerKey = 'sendToFriends' | 'withdrawToOwnAccounts' | 'shareRequestLink' | 'shareBankDetails'
type HomeDrawerBodyKey =
    | 'sendToFriendsDescription'
    | 'withdrawToOwnAccountsDescription'
    | 'shareRequestLinkDescription'
    | 'shareBankDetailsDescription'
export type AddMethodKey = 'bankTransfer' | 'crypto'
type AddMethodBodyKey = 'bankTransferDescription' | 'cryptoDescription'

export interface DrawerOption {
    key: string
    /** i18n namespace + key — 'drawers' = home.drawers, 'methods' = addMoney.methods */
    titleKey: ['drawers', HomeDrawerKey] | ['methods', AddMethodKey]
    bodyKey?: ['drawers', HomeDrawerBodyKey] | ['methods', AddMethodBodyKey]
    icon: IconName
    /** bubble colour, from the concept map like the Send page (SendRouter) */
    iconColor: IconBubbleColor
    href: string
}

// send drawer board 17831:79186; add drawer board 17830:76839. withdraw is
// reachable from home through the SEND drawer only (product ruling 2026-08-21:
// the add drawer is bank transfer + crypto, per the board's visible items).
const BANK_ONE_OFF: DrawerOption = {
    key: 'bank',
    titleKey: ['methods', 'bankTransfer'],
    icon: CONCEPT_ICONS.bank.icon,
    iconColor: CONCEPT_ICONS.bank.color,
    href: '/add-money?method=bank',
}

const DRAWER_OPTIONS: Record<HomeDrawer, DrawerOption[]> = {
    send: [
        {
            key: 'send-friends',
            titleKey: ['drawers', 'sendToFriends'],
            bodyKey: ['drawers', 'sendToFriendsDescription'],
            // person iconography, not arrows: the home CTAs that open this
            // drawer are already arrows, so repeating them here said nothing.
            // friends = several people, own accounts = one person (you).
            icon: CONCEPT_ICONS.friends.icon,
            iconColor: CONCEPT_ICONS.friends.color,
            href: '/send',
        },
        {
            key: 'withdraw',
            titleKey: ['drawers', 'withdrawToOwnAccounts'],
            bodyKey: ['drawers', 'withdrawToOwnAccountsDescription'],
            icon: CONCEPT_ICONS.withdraw.icon,
            iconColor: CONCEPT_ICONS.withdraw.color,
            href: '/withdraw',
        },
    ],
    add: [
        // bank first (2026-09-18 decision, per product/activation-funnel.md):
        // most users already have a bank account, so bank leads and crypto —
        // the KYC-free path — is the second option.
        BANK_ONE_OFF,
        {
            key: 'crypto',
            titleKey: ['methods', 'crypto'],
            bodyKey: ['methods', 'cryptoDescription'],
            icon: CONCEPT_ICONS.crypto.icon,
            iconColor: CONCEPT_ICONS.crypto.color,
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
            icon: CONCEPT_ICONS.requestLink.icon,
            iconColor: CONCEPT_ICONS.requestLink.color,
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
    icon: CONCEPT_ICONS.bank.icon,
    iconColor: CONCEPT_ICONS.bank.color,
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
    icon: CONCEPT_ICONS.bank.icon,
    iconColor: CONCEPT_ICONS.bank.color,
    href: '/add-money?method=bank',
}

function addOptions(depositAccountsEnabled: boolean): DrawerOption[] {
    return DRAWER_OPTIONS.add.map((option) =>
        option.key === 'bank' && depositAccountsEnabled ? BANK_STANDING : option
    )
}

/**
 * The rows a home drawer shows. The home submenu reads the same list: a drawer
 * that would hold one row is an extra tap, so the submenu links straight to
 * that row's destination instead.
 */
export function homeDrawerOptions(drawer: HomeDrawer, depositAccountsEnabled: boolean): DrawerOption[] {
    if (drawer === 'add') return addOptions(depositAccountsEnabled)
    if (drawer === 'request') return requestOptions(depositAccountsEnabled)
    return DRAWER_OPTIONS[drawer]
}
