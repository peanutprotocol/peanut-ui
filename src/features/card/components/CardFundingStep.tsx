'use client'

import * as Sentry from '@sentry/nextjs'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { Callout } from '@/components/0_Bruddle/Callout'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import NavHeader from '@/components/Global/NavHeader'
import { useAuth } from '@/context/authContext'
import { AddMoneyDrawer } from '@/features/add-money/drawer/AddMoneyDrawer'
import { addMoneyGapUsd, bankPageHref, drawerBankPlan } from '@/features/add-money/drawer/addMoneyDrawerPlan'
import {
    captureAddMoneyDrawerClosed,
    captureAddMoneyRailPicked,
    pickerMethodOf,
    type AddMoneyDrawerView,
    type DrawerMethod,
} from '@/features/add-money/drawer/drawerAnalytics'
import { BankMethodRow } from '@/features/add-money/drawer/BankMethodRow'
import { CryptoMethodRow } from '@/features/add-money/drawer/CryptoMethodRow'
import { useBankMethodState } from '@/features/add-money/drawer/useBankMethodState'
import { useAddMoneyReadiness } from '@/features/add-money/useAddMoneyReadiness'
import { captureCardGateAddFundsTapped, captureCardGateCameBackFunded } from '@/features/card/card-gate-analytics'
import { CARD_FUNDING_RETURN_TO, CARD_MIN_BALANCE_USD } from '@/features/card/cardAddMoney'
import { cardApi } from '@/services/card'
import { readStoredValue, removeStoredValue, writeStoredValue } from '@/utils/safe-storage'
import { formatBankAmount } from '@/utils/currency'

const cardReturnTo = () => CARD_FUNDING_RETURN_TO

/**
 * The card's $10 step. Bank and Crypto open the add-money drawer in place, so the step never
 * unmounts while the user adds money, and the drawer closes itself once the balance covers it.
 */
export function CardFundingStep({
    userId,
    funded,
    balanceKnown,
    spendableUsd,
    onPrev,
    onContinue,
}: {
    userId: string
    funded: boolean
    balanceKnown: boolean
    /** the spendable balance in dollars; undefined while it loads */
    spendableUsd?: number
    onPrev: () => void
    /** to the application step */
    onContinue: () => void
}) {
    const t = useTranslations('card.onboarding')
    const tAdd = useTranslations('addMoney')
    const tCommon = useTranslations('common')
    const tCard = useTranslations('card.addMoney')
    const router = useRouter()
    const readiness = useAddMoneyReadiness(false)
    const { user } = useAuth()
    const plan = drawerBankPlan({ ...readiness, identityStatus: user?.identityVerification?.status })
    const gapUsd = addMoneyGapUsd(CARD_MIN_BALANCE_USD, spendableUsd)

    // one drawer per opening (`n` remounts it), kept mounted closed through vaul's exit animation
    const [drawer, setDrawer] = useState<{ method: DrawerMethod; n: number }>()
    const [open, setOpen] = useState(false)
    const shown = useRef<{ method: DrawerMethod | null; view: AddMoneyDrawerView } | null>(null)
    const onShow = useCallback((method: DrawerMethod | null, view: AddMoneyDrawerView) => {
        shown.current = { method, view }
    }, [])

    // the drawer closes on funding only when it opened short; a funded user who opens it stays in it
    const openedShort = useRef(false)
    const pickMethod = (method: DrawerMethod) => {
        openedShort.current = !funded
        // one bank way, and it is a page: a drawer with one row would only add a tap
        const onlyPage =
            method === 'bank' && plan.kind === 'rows' && plan.rows.length === 1 && plan.rows[0].kind === 'page'
                ? plan.rows[0].corridor
                : undefined
        // this tap picks that rail itself, so ARS and Pix count as themselves (TASK-25444)
        captureCardGateAddFundsTapped('funding', funded, onlyPage ? pickerMethodOf(onlyPage) : method)
        if (onlyPage) {
            captureAddMoneyRailPicked('card', onlyPage, 'page')
            router.push(bankPageHref(onlyPage, gapUsd, readiness.residenceIso2s, CARD_FUNDING_RETURN_TO))
            return
        }
        shown.current = null
        setDrawer((last) => ({ method, n: (last?.n ?? 0) + 1 }))
        setOpen(true)
    }

    // stable: it reads only a ref, so the effect that closes a blocked bank drawer does not re-run on it
    const dismiss = useCallback(() => {
        if (shown.current) captureAddMoneyDrawerClosed('card', shown.current.method, shown.current.view)
        setOpen(false)
    }, [])

    // "I've sent the transfer": the step says the money is on its way until the balance covers the gap,
    // which is the step being funded; a smaller deposit landing meanwhile does not clear it. Session
    // storage keeps it through a refresh; saving the step server-side is bank resume. A non-dollar
    // transfer is not named in dollars.
    const sentKey = `card_gate_bank_sent_v3:${userId}`
    const [sent, setSent] = useState<{ usd: number | null } | undefined>(() => {
        try {
            const stored = JSON.parse(readStoredValue(sentKey, 'sessionStorage') ?? 'null')
            return stored && 'usd' in stored ? stored : undefined
        } catch {
            return undefined
        }
    })
    const bankSent = (inDollars: boolean) => {
        dismiss()
        if (!gapUsd) return
        const next = { usd: inDollars ? gapUsd : null }
        setSent(next)
        writeStoredValue(sentKey, JSON.stringify(next), 'sessionStorage')
        // the push for the landing deposit then opens this step; without it the plain receipt push goes
        cardApi.markFundingPending().catch((error) => Sentry.captureException(error))
    }
    const sentLanded = !!sent && funded
    useEffect(() => {
        if (!sentLanded) return
        setSent(undefined)
        removeStoredValue(sentKey, 'sessionStorage')
    }, [sentLanded, sentKey])

    // Before/after for the drawer: the balance reached the minimum after this step showed it short.
    // Session storage, so a user who funds on another page (a bank page, Home) and comes back counts too.
    const shortKey = `card_gate_saw_short_v1:${userId}`
    useEffect(() => {
        if (!balanceKnown) return
        if (!funded) {
            writeStoredValue(shortKey, '1', 'sessionStorage')
            return
        }
        if (readStoredValue(shortKey, 'sessionStorage') !== '1') return
        writeStoredValue(shortKey, 'reported', 'sessionStorage')
        captureCardGateCameBackFunded(open, shown.current?.method ?? drawer?.method ?? null)
    }, [shortKey, funded, balanceKnown, open, drawer])

    useEffect(() => {
        if (!funded || !open || !openedShort.current) return
        setOpen(false)
        onContinue()
    }, [funded, open, onContinue])

    const bank = useBankMethodState(plan)
    // The bank became one the user cannot use while its drawer was open (a review started, readiness
    // changed): close it rather than leave a view with nothing to do. A crypto view in it stays.
    useEffect(() => {
        if (!open || !bank.blocked || bank.unknown || shown.current?.method !== 'bank') return
        dismiss()
    }, [open, bank.blocked, bank.unknown, dismiss])
    const bankRow = <BankMethodRow bank={bank} onClick={() => pickMethod('bank')} testId="card-add-money-bank" />
    return (
        <PageStack>
            <NavHeader title={t('navTitle')} onPrev={onPrev} />
            <h1 className="text-heading-s text-foreground-primary">{tAdd('title')}</h1>
            <ListGroup>
                {bank.offered && bankRow}
                <CryptoMethodRow onClick={() => pickMethod('crypto')} testId="card-add-money-crypto" />
                {!bank.offered && bankRow}
            </ListGroup>
            {drawer && (
                <AddMoneyDrawer
                    key={drawer.n}
                    open={open}
                    method={drawer.method}
                    targetUsd={CARD_MIN_BALANCE_USD}
                    funded={funded}
                    gapUsd={gapUsd}
                    plan={plan}
                    residenceIso2s={readiness.residenceIso2s}
                    returnTo={cardReturnTo}
                    place="card"
                    onShow={onShow}
                    onDismiss={dismiss}
                    onBankSent={bankSent}
                />
            )}
            <PageStack.Footer>
                {/* one note right above the CTA: the transfer on its way replaces the gap note */}
                {sent && !sentLanded ? (
                    <Callout priority="info" data-testid="card-add-money-bank-sent">
                        {sent.usd
                            ? tCard('bankSentPending', { amount: formatBankAmount(sent.usd, 'USD') })
                            : tCard('bankSentPendingNoAmount')}
                    </Callout>
                ) : (
                    <Callout priority="info" data-testid="card-add-money-gap">
                        {gapUsd && spendableUsd !== undefined
                            ? t('fundingBodyGap', {
                                  minimum: formatBankAmount(CARD_MIN_BALANCE_USD, 'USD'),
                                  // a spendable balance rounds down (in whole units first: 0.29 * 100 is 28.999…)
                                  balance: formatBankAmount(
                                      Math.floor(Math.round(spendableUsd * 1e6) / 1e4) / 100,
                                      'USD'
                                  ),
                                  gap: formatBankAmount(gapUsd, 'USD'),
                              })
                            : t('fundingBody')}
                    </Callout>
                )}
                <Button variant="primary" className="w-full" disabled={!funded} onClick={onContinue}>
                    {tCommon('continue')}
                </Button>
            </PageStack.Footer>
        </PageStack>
    )
}
