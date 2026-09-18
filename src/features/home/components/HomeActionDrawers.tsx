'use client'

import { Drawer, DrawerContent, DrawerTitle } from '@/components/Global/Drawer'
import { Icon, type IconName } from '@/components/Global/Icons/Icon'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { getCardPosition } from '@/components/Global/Card/card.utils'
import { useHomeDrawer, type HomeDrawer } from '../useHomeDrawer'
import { parseAsString, useQueryState } from 'nuqs'
import { useRouter } from 'next/navigation'
import { useRef } from 'react'
import { useTranslations } from 'next-intl'
import { RETURN_TO_PARAM } from '@/utils/return-to.utils'
import { useDepositAccountsEnabled } from '@/features/deposit-accounts/useDepositAccountsEnabled'

type HomeDrawerKey = 'sendToFriends' | 'withdrawToOwnAccounts' | 'shareRequestLink' | 'shareBankDetails'
type HomeDrawerBodyKey =
    | 'sendToFriendsDescription'
    | 'withdrawToOwnAccountsDescription'
    | 'shareRequestLinkDescription'
    | 'shareBankDetailsDescription'
type AddMethodKey = 'bankTransfer' | 'crypto'
type AddMethodBodyKey = 'bankTransferDescription' | 'cryptoDescription'

interface DrawerOption {
    key: string
    /** i18n namespace + key — 'drawers' = home.drawers, 'methods' = addMoney.methods */
    titleKey: ['drawers', HomeDrawerKey] | ['methods', AddMethodKey]
    bodyKey?: ['drawers', HomeDrawerBodyKey] | ['methods', AddMethodBodyKey]
    icon: IconName
    href: string
}

// send drawer board 17831:79186; add drawer board 17830:76839. withdraw is
// reachable from home through the SEND drawer only (product ruling 2026-08-21:
// the add drawer is bank transfer + crypto, per the board's visible items).
const BANK_ONE_OFF: DrawerOption = {
    key: 'bank',
    titleKey: ['methods', 'bankTransfer'],
    icon: 'bank',
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
            icon: 'users',
            href: '/send',
        },
        {
            key: 'withdraw',
            titleKey: ['drawers', 'withdrawToOwnAccounts'],
            bodyKey: ['drawers', 'withdrawToOwnAccountsDescription'],
            icon: 'user',
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
            icon: 'coins',
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
            icon: 'link',
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
    icon: 'bank',
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
    icon: 'bank',
    href: '/add-money?method=bank',
}

function addOptions(depositAccountsEnabled: boolean): DrawerOption[] {
    return DRAWER_OPTIONS.add.map((option) =>
        option.key === 'bank' && depositAccountsEnabled ? BANK_STANDING : option
    )
}

/**
 * home IA bottom drawers (figma boards 17831:79186 / 17830:76839): the Add and
 * Send quick actions open a drawer with routing options instead of navigating.
 * open state is url-backed via useHomeDrawer (?drawer=add|send).
 */
export function HomeActionDrawers() {
    const [drawer, setDrawer] = useHomeDrawer()
    const t = useTranslations('home.drawers')
    const tMethods = useTranslations('addMoney.methods')
    const tNav = useTranslations('navigation')
    const router = useRouter()
    // the bare /add-money redirect carries the caller's returnTo here — read
    // it via nuqs (URL as state) so it can ride onto the chosen destination
    const [returnTo, setReturnTo] = useQueryState(RETURN_TO_PARAM, parseAsString)
    // keep the last open drawer rendered through vaul's exit animation so the
    // sheet doesn't empty mid-slide when the url param clears
    const lastDrawerRef = useRef<HomeDrawer | null>(null)
    if (drawer) lastDrawerRef.current = drawer
    const content = drawer ?? lastDrawerRef.current
    const depositAccounts = useDepositAccountsEnabled()
    const options =
        content === 'add'
            ? addOptions(depositAccounts)
            : content === 'request'
              ? requestOptions(depositAccounts)
              : content
                ? DRAWER_OPTIONS[content]
                : []

    const navigate = async (option: DrawerOption) => {
        const href = option.href
        // clear the drawer param first so browser-back from the destination
        // lands on a closed home; nuqs queues url updates, so await the reset
        // before routing or the ?drawer entry can survive in history
        // a caller's returnTo (carried here by the bare /add-money redirect)
        // rides to the chosen destination — and is CLEARED from home's own
        // history entry, or reopening Add later would forward a stale origin
        // into an unrelated flow (chip P15-minor)
        const origin = returnTo
        await Promise.all([setDrawer(null), setReturnTo(null)])
        const target = origin
            ? `${href}${href.includes('?') ? '&' : '?'}${RETURN_TO_PARAM}=${encodeURIComponent(origin)}`
            : href
        router.push(target)
    }

    return (
        <Drawer open={drawer !== null} onOpenChange={(isOpen) => !isOpen && setDrawer(null)} hideBottomNav>
            <DrawerContent className="pb-2">
                {content && (
                    <div className="flex flex-col gap-4">
                        <DrawerTitle className="text-center text-heading-s text-foreground-primary">
                            {tNav(content)}
                        </DrawerTitle>
                        <div className="flex flex-col">
                            {options.map((option, index, all) => (
                                <ListItem
                                    key={option.key}
                                    position={getCardPosition(index, all.length)}
                                    leading={<Icon name={option.icon} size={24} className="text-foreground-primary" />}
                                    title={
                                        option.titleKey[0] === 'methods'
                                            ? tMethods(option.titleKey[1] as AddMethodKey)
                                            : t(option.titleKey[1] as HomeDrawerKey)
                                    }
                                    body={
                                        option.bodyKey
                                            ? option.bodyKey[0] === 'methods'
                                                ? tMethods(option.bodyKey[1])
                                                : t(option.bodyKey[1])
                                            : undefined
                                    }
                                    chevron
                                    onClick={() => navigate(option)}
                                    data-testid={`home-drawer-${content}-${option.key}`}
                                />
                            ))}
                        </div>
                    </div>
                )}
            </DrawerContent>
        </Drawer>
    )
}
