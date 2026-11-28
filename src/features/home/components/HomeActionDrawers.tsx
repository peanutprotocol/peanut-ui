'use client'

import { Drawer, DrawerContent, DrawerTitle } from '@/components/Global/Drawer'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import Badge from '@/components/Global/Badges/Badge'
import { useHomeDrawer, type HomeDrawer } from '../useHomeDrawer'
import { homeDrawerOptions } from '../home-drawer-options'
import { parseAsString, useQueryState } from 'nuqs'
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useDepositAccountsEnabled } from '@/features/deposit-accounts/useDepositAccountsEnabled'
import { addMoneyMethodHref, type AddMoneyPickerMethod } from '@/features/add-money/addMoneyMethods'
import { useAddMoneyMethodRows } from '@/features/add-money/useAddMoneyMethodRows'
import { readLastDepositMethod, splitLastUsed } from '@/features/add-money/lastUsedAddMethod'
import type { useAddMoneyReadiness } from '@/features/add-money/useAddMoneyReadiness'
import { readReturnTo, RETURN_TO_PARAM, withReturnTo } from '@/utils/return-to.utils'

/**
 * home IA bottom drawers (figma boards 17831:79186 / 17830:76839): the Add and
 * Send quick actions open a drawer with routing options instead of navigating.
 * open state is url-backed via useHomeDrawer (?drawer=add|send).
 */
export function HomeActionDrawers({
    addMoney,
}: {
    addMoney: Pick<ReturnType<typeof useAddMoneyReadiness>, 'entry' | 'pickerMethods' | 'isLoading'>
}) {
    const [drawer, setDrawer] = useHomeDrawer()
    const t = useTranslations('home.drawers')
    const tNav = useTranslations('navigation')
    const router = useRouter()
    // Carry origins from existing Add drawer links into the chosen destination.
    const [returnTo, setReturnTo] = useQueryState(RETURN_TO_PARAM, parseAsString)
    const origin = readReturnTo(new URLSearchParams(returnTo ? { returnTo } : {}), '/home')
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
            void Promise.all([setDrawer(null), setReturnTo(null)]).then(() =>
                router.replace(origin ? withReturnTo('/add-money', origin) : '/add-money')
            )
        }
        if (drawer !== 'add') redirecting.current = false
    }, [drawer, staleAdd, origin, router, setDrawer, setReturnTo])
    const methodRows = useAddMoneyMethodRows()
    const addRow = (method: AddMoneyPickerMethod) => ({
        key: method,
        title: methodRows[method].title,
        leading: methodRows[method].icon,
        // an Add row returns to its origin, else Home; the bank hub keeps only a real origin
        href: addMoneyMethodHref(method, origin ?? '/home', origin),
    })
    // the Add drawer lists the picker's rows, with the method of the last completed deposit first
    const { lastUsed, others } = splitLastUsed(
        addMoney.pickerMethods,
        content === 'add' ? readLastDepositMethod() : null
    )
    const options =
        content === 'add'
            ? (lastUsed ? [lastUsed, ...others] : others).map(addRow)
            : (content ? homeDrawerOptions(content, depositAccounts) : []).map((option) => ({
                  key: option.key,
                  href: origin ? withReturnTo(option.href, origin) : option.href,
                  leading: <IconBubble {...CONCEPT_ICONS[option.concept]} size="s" />,
                  title: t(option.titleKey),
                  body: option.bodyKey ? t(option.bodyKey) : undefined,
              }))

    const navigate = async (option: { href: string }) => {
        if (navigating.current) return
        navigating.current = true
        try {
            // Clear Home's drawer state before navigating so Back lands on closed Home.
            await Promise.all([setDrawer(null), setReturnTo(null)])
            router.push(option.href)
        } finally {
            navigating.current = false
        }
    }

    const renderRows = (rows: typeof options) =>
        rows.map((option) => (
            <ListItem
                key={option.key}
                leading={option.leading}
                title={option.title}
                body={'body' in option ? option.body : undefined}
                // the last used row carries a pill instead of its own section (Hugo, via Kush 28 Nov).
                // neutral: a fact with no tone (design.md, badges)
                trailing={option.key === lastUsed ? <Badge status="neutral" customText={t('lastUsed')} /> : undefined}
                // the descriptions are a sentence, and a one-line
                // cut ate half of it in pt-BR and es-419
                bodyWrap
                chevron
                onClick={() => navigate(option)}
                data-testid={`home-drawer-${content}-${option.key}`}
            />
        ))

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
                        <ListGroup>{renderRows(options)}</ListGroup>
                    </div>
                )}
            </DrawerContent>
        </Drawer>
    )
}
