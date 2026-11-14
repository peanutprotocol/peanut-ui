'use client'

import { Drawer, DrawerContent, DrawerTitle } from '@/components/Global/Drawer'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { getCardPosition } from '@/components/Global/Card/card.utils'
import { useHomeDrawer, type HomeDrawer } from '../useHomeDrawer'
import { homeDrawerOptions } from '../home-drawer-options'
import { parseAsString, useQueryState } from 'nuqs'
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useDepositAccountsEnabled } from '@/features/deposit-accounts/useDepositAccountsEnabled'
import type { useAddMoneyReadiness } from '@/features/add-money/useAddMoneyReadiness'
import { readReturnTo, RETURN_TO_PARAM, withReturnTo } from '@/utils/return-to.utils'
import PIX from '@/assets/payment-apps/pix.svg'
import Image from 'next/image'

/**
 * home IA bottom drawers (figma boards 17831:79186 / 17830:76839): the Add and
 * Send quick actions open a drawer with routing options instead of navigating.
 * open state is url-backed via useHomeDrawer (?drawer=add|send).
 */
export function HomeActionDrawers({
    addMoney,
}: {
    addMoney: Pick<ReturnType<typeof useAddMoneyReadiness>, 'entry' | 'drawerMethods' | 'isLoading'>
}) {
    const [drawer, setDrawer] = useHomeDrawer()
    const t = useTranslations('home.drawers')
    const tMethods = useTranslations('addMoney.methods')
    const tNav = useTranslations('navigation')
    const tProfile = useTranslations('profile.unlockPayments')
    const router = useRouter()
    // Carry origins from existing Add drawer links into the chosen destination.
    const [returnTo, setReturnTo] = useQueryState(RETURN_TO_PARAM, parseAsString)
    // keep the last open drawer rendered through vaul's exit animation so the
    // sheet doesn't empty mid-slide when the url param clears
    const lastDrawerRef = useRef<HomeDrawer | null>(null)
    if (drawer) lastDrawerRef.current = drawer
    const content = drawer ?? lastDrawerRef.current
    const depositAccounts = useDepositAccountsEnabled()
    const redirecting = useRef(false)
    const navigating = useRef(false)
    const suppressAdd = drawer === 'add' && addMoney.entry === 'picker'
    const staleAdd = suppressAdd && !addMoney.isLoading
    useEffect(() => {
        if (staleAdd && !redirecting.current) {
            redirecting.current = true
            const origin = readReturnTo(new URLSearchParams(returnTo ? { returnTo } : {}), '/home')
            void Promise.all([setDrawer(null), setReturnTo(null)]).then(() =>
                router.replace(origin ? withReturnTo('/add-money', origin) : '/add-money')
            )
        }
        if (drawer !== 'add') redirecting.current = false
    }, [drawer, staleAdd, returnTo, router, setDrawer, setReturnTo])
    const options =
        content === 'add'
            ? addMoney.drawerMethods.map((method) => ({
                  key: method,
                  title:
                      method === 'account'
                          ? tProfile('titles.bank')
                          : method === 'transfer'
                            ? tMethods('oneTimeTransfer')
                            : method === 'pix'
                              ? tMethods('payPix')
                              : method === 'crypto'
                                ? tMethods('crypto')
                                : tMethods('moreWays'),
                  leading:
                      method === 'pix' ? (
                          <Image src={PIX} alt="" width={32} height={32} />
                      ) : method === 'account' ? (
                          <IconBubble {...CONCEPT_ICONS.bankAccount} size="s" />
                      ) : (
                          <IconBubble {...(method === 'crypto' ? CONCEPT_ICONS.crypto : CONCEPT_ICONS.bank)} size="s" />
                      ),
                  href:
                      method === 'more'
                          ? '/add-money'
                          : method === 'crypto'
                            ? '/add-money/crypto'
                            : `/add-money/options?method=${method}&ready=1`,
              }))
            : (content ? homeDrawerOptions(content, depositAccounts) : []).map((option) => ({
                  key: option.key,
                  href: option.href,
                  leading: <IconBubble {...CONCEPT_ICONS[option.concept]} size="s" />,
                  title: t(option.titleKey),
                  body: option.bodyKey ? t(option.bodyKey) : undefined,
              }))

    const navigate = async (option: { href: string }) => {
        if (navigating.current) return
        navigating.current = true
        const origin = readReturnTo(new URLSearchParams(returnTo ? { returnTo } : {}), '/home')
        try {
            // Clear Home's drawer state before navigating so Back lands on closed Home.
            await Promise.all([setDrawer(null), setReturnTo(null)])
            router.push(origin ? withReturnTo(option.href, origin) : option.href)
        } finally {
            navigating.current = false
        }
    }

    return (
        <Drawer
            open={drawer !== null && !suppressAdd}
            onOpenChange={(isOpen) => !isOpen && setDrawer(null)}
            hideBottomNav
        >
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
                                    leading={option.leading}
                                    title={option.title}
                                    body={'body' in option ? option.body : undefined}
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
