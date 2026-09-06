'use client'

import { Drawer, DrawerContent, DrawerTitle } from '@/components/Global/Drawer'
import { Icon, type IconName } from '@/components/Global/Icons/Icon'
import { ScreenMark } from '@/components/0_Bruddle/ScreenMark'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { getCardPosition } from '@/components/Global/Card/card.utils'
import { useHomeDrawer, type HomeDrawer } from '../useHomeDrawer'
import { parseAsString, useQueryState } from 'nuqs'
import { useRouter } from 'next/navigation'
import { useRef } from 'react'
import { useTranslations } from 'next-intl'
import { RETURN_TO_PARAM } from '@/utils/return-to.utils'

type HomeDrawerKey = 'sendToFriends' | 'withdrawToOwnAccounts'
type HomeDrawerBodyKey = 'sendToFriendsDescription' | 'withdrawToOwnAccountsDescription'
type AddMethodKey = 'bankTransfer' | 'crypto'

interface DrawerOption {
    key: string
    /** i18n namespace + key — 'drawers' = home.drawers, 'methods' = addMoney.methods */
    titleKey: ['drawers', HomeDrawerKey] | ['methods', AddMethodKey]
    bodyKey?: HomeDrawerBodyKey
    icon: IconName
    href: string
}

// send drawer board 17831:79186; add drawer board 17830:76839. withdraw is
// reachable from home through the SEND drawer only (product ruling 2026-08-21:
// the add drawer is bank transfer + crypto, per the board's visible items).
const DRAWER_OPTIONS: Record<HomeDrawer, DrawerOption[]> = {
    send: [
        {
            key: 'send-friends',
            titleKey: ['drawers', 'sendToFriends'],
            bodyKey: 'sendToFriendsDescription',
            // person iconography, not arrows: the home CTAs that open this
            // drawer are already arrows, so repeating them here said nothing.
            // friends = several people, own accounts = one person (you).
            icon: 'users',
            href: '/send',
        },
        {
            key: 'withdraw',
            titleKey: ['drawers', 'withdrawToOwnAccounts'],
            bodyKey: 'withdrawToOwnAccountsDescription',
            icon: 'user',
            href: '/withdraw',
        },
    ],
    add: [
        // crypto first: the KYC-free path leads per product/activation-funnel.md
        { key: 'crypto', titleKey: ['methods', 'crypto'], icon: 'credit-card', href: '/add-money/crypto' },
        { key: 'bank', titleKey: ['methods', 'bankTransfer'], icon: 'bank', href: '/add-money?method=bank' },
    ],
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

    const navigate = async (href: string) => {
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
            <DrawerContent className="px-4 pb-2">
                {content && (
                    <div className="flex flex-col gap-4">
                        {content === 'add' && <ScreenMark icon="plus" />}
                        <DrawerTitle className="text-center text-heading-s text-foreground-primary">
                            {tNav(content)}
                        </DrawerTitle>
                        <div className="flex flex-col">
                            {DRAWER_OPTIONS[content].map((option, index, all) => (
                                <ListItem
                                    key={option.key}
                                    position={getCardPosition(index, all.length)}
                                    leading={<Icon name={option.icon} size={24} className="text-foreground-primary" />}
                                    title={
                                        option.titleKey[0] === 'methods'
                                            ? tMethods(option.titleKey[1] as AddMethodKey)
                                            : t(option.titleKey[1] as HomeDrawerKey)
                                    }
                                    body={option.bodyKey ? t(option.bodyKey) : undefined}
                                    chevron
                                    onClick={() => navigate(option.href)}
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
