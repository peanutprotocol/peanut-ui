'use client'

import { Drawer, DrawerContent, DrawerTitle } from '@/components/Global/Drawer'
import { Icon } from '@/components/Global/Icons/Icon'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { getCardPosition } from '@/components/Global/Card/card.utils'
import { useHomeDrawer, type HomeDrawer } from '../useHomeDrawer'
import { homeDrawerOptions, type AddMethodKey, type DrawerOption, type HomeDrawerKey } from '../home-drawer-options'
import { parseAsString, useQueryState } from 'nuqs'
import { useRouter } from 'next/navigation'
import { useRef } from 'react'
import { useTranslations } from 'next-intl'
import { RETURN_TO_PARAM } from '@/utils/return-to.utils'
import { useDepositAccountsEnabled } from '@/features/deposit-accounts/useDepositAccountsEnabled'

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
    const options = content ? homeDrawerOptions(content, depositAccounts) : []

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
                                    // the descriptions are a sentence, and a one-line
                                    // cut ate half of it in pt-BR and es-419
                                    bodyWrap
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
