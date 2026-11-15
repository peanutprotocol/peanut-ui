import { type Concept } from '@/components/0_Bruddle/conceptIcons'
import { type HomeDrawer } from './useHomeDrawer'

type HomeDrawerKey = 'sendToFriends' | 'withdrawToOwnAccounts' | 'shareRequestLink' | 'shareBankDetails'
type HomeDrawerBodyKey =
    | 'sendToFriendsDescription'
    | 'withdrawToOwnAccountsDescription'
    | 'shareRequestLinkDescription'
    | 'shareBankDetailsDescription'
export interface DrawerOption {
    key: string
    titleKey: HomeDrawerKey
    bodyKey?: HomeDrawerBodyKey
    /** the row's icon and bubble colour come from the concept map, as on the Send page (SendRouter) */
    concept: Concept
    href: string
}

const DRAWER_OPTIONS: Record<Exclude<HomeDrawer, 'add'>, DrawerOption[]> = {
    send: [
        {
            key: 'send-friends',
            titleKey: 'sendToFriends',
            bodyKey: 'sendToFriendsDescription',
            // friends = several people; the withdraw row below takes the
            // withdraw concept (arrow up, the mirror of add money's arrow down).
            concept: 'friends',
            href: '/send',
        },
        {
            key: 'withdraw',
            titleKey: 'withdrawToOwnAccounts',
            bodyKey: 'withdrawToOwnAccountsDescription',
            concept: 'withdraw',
            href: '/withdraw',
        },
    ],
    // Two ways to be paid. A request link asks one person for one amount and is
    // answered inside Peanut; standing bank details take any amount from anybody
    // straight into the requester's account, with no link. The bank row is added
    // in `requestOptions` only where the provider will open an account.
    request: [
        {
            key: 'share-link',
            titleKey: 'shareRequestLink',
            bodyKey: 'shareRequestLinkDescription',
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
    titleKey: 'shareBankDetails',
    bodyKey: 'shareBankDetailsDescription',
    concept: 'bank',
    href: '/add-money?method=bank',
}

function requestOptions(depositAccountsEnabled: boolean): DrawerOption[] {
    return depositAccountsEnabled ? [...DRAWER_OPTIONS.request, SHARE_BANK_DETAILS] : DRAWER_OPTIONS.request
}

export function homeDrawerOptions(drawer: Exclude<HomeDrawer, 'add'>, depositAccountsEnabled: boolean): DrawerOption[] {
    return drawer === 'request' ? requestOptions(depositAccountsEnabled) : DRAWER_OPTIONS[drawer]
}
