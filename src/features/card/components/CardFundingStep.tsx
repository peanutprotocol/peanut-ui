'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { Callout } from '@/components/0_Bruddle/Callout'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import Badge from '@/components/Global/Badges/Badge'
import NavHeader from '@/components/Global/NavHeader'
import { useAuth } from '@/context/authContext'
import { useAddMoneyReadiness } from '@/features/add-money/useAddMoneyReadiness'
import {
    captureCardAddMoneyDrawerClosed,
    captureCardAddMoneyRailPicked,
    captureCardGateAddFundsTapped,
    captureCardGateCameBackFunded,
    type CardAddMoneyView,
    type CardFundingMethod,
} from '@/features/card/card-gate-analytics'
import { CARD_MIN_BALANCE_USD, cardBankPageHref, cardBankPlan, cardGapUsd } from '@/features/card/cardAddMoney'
import { useBankRegionRefusal } from '@/features/card/useBankRegionRefusal'
import { readStoredValue, removeStoredValue, writeStoredValue } from '@/utils/safe-storage'
import { formatBankAmount } from '@/utils/currency'
import { CardAddMoneyDrawer } from './CardAddMoneyDrawer'

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
    const tAccounts = useTranslations('depositAccounts')
    const router = useRouter()
    const readiness = useAddMoneyReadiness(false)
    const { user } = useAuth()
    const plan = cardBankPlan({ ...readiness, identityStatus: user?.identityVerification?.status })
    const gapUsd = cardGapUsd(spendableUsd)

    // one drawer per opening (`n` remounts it), kept mounted closed through vaul's exit animation
    const [drawer, setDrawer] = useState<{ method: CardFundingMethod; n: number }>()
    const [open, setOpen] = useState(false)
    const shown = useRef<{ method: CardFundingMethod; view: CardAddMoneyView } | null>(null)
    const onShow = useCallback((method: CardFundingMethod, view: CardAddMoneyView) => {
        shown.current = { method, view }
    }, [])

    // the drawer closes on funding only when it opened short; a funded user who opens it stays in it
    const openedShort = useRef(false)
    const pickMethod = (method: CardFundingMethod) => {
        captureCardGateAddFundsTapped('funding', funded, method)
        openedShort.current = !funded
        // one bank way, and it is a page: a drawer with one row would only add a tap
        if (method === 'bank' && plan.kind === 'rows' && plan.rows.length === 1 && plan.rows[0].kind === 'page') {
            const { corridor } = plan.rows[0]
            captureCardAddMoneyRailPicked(corridor, 'page')
            router.push(cardBankPageHref(corridor, gapUsd, readiness.residenceIso2s))
            return
        }
        shown.current = null
        setDrawer((last) => ({ method, n: (last?.n ?? 0) + 1 }))
        setOpen(true)
    }

    const dismiss = () => {
        if (shown.current) captureCardAddMoneyDrawerClosed(shown.current.method, shown.current.view)
        setOpen(false)
    }

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

    // The badge names the block. Kush (2026-11-26): a bank the user cannot use now (under review,
    // setting up, or ruled out by the residence) is a disabled row with its badge and no drawer, sorted
    // last when it is not offered. This departs from design.md "rows the user cannot act on" (such a
    // row stays tappable and its tap says why), by his decision. Not verified, and a step left, stay
    // tappable: the user can act on them.
    const regionRefusal = useBankRegionRefusal()
    const bankOffered = !(plan.kind === 'not-offered' && regionRefusal)
    const bankBlocked = !bankOffered || plan.kind === 'under-review' || plan.kind === 'setting-up'
    const bankBadge = !bankOffered ? (
        <Badge status="neutral" customText={tAccounts('list.badgeNotOffered')} />
    ) : plan.kind === 'not-verified' ? (
        <Badge status="pending" customText={tAccounts('list.badgeVerifyId')} />
    ) : plan.kind === 'under-review' ? (
        <Badge status="pending" customText={tAccounts('list.badgeUnderReview')} />
    ) : plan.kind === 'setting-up' ? (
        <Badge status="pending" customText={tAccounts('list.badgeSettingUp')} />
    ) : plan.kind === 'finish-setup' || plan.kind === 'not-offered' ? (
        <Badge status="pending" customText={tAccounts('list.badgeActionNeeded')} />
    ) : undefined
    const bankRow = (
        <ListItem
            title={tAdd('methods.bankTransfer')}
            body={tAdd('methods.bankTransferDescription')}
            bodyWrap
            leading={<IconBubble {...CONCEPT_ICONS.bank} {...(bankOffered ? {} : { color: 'gray' })} size="s" />}
            trailing={bankBadge}
            chevron={!bankBlocked}
            disabled={bankBlocked}
            onClick={() => pickMethod('bank')}
            data-testid="card-add-money-bank"
        />
    )
    return (
        <PageStack>
            <NavHeader title={t('navTitle')} onPrev={onPrev} />
            <h1 className="text-heading-s text-foreground-primary">{tAdd('title')}</h1>
            <p className="text-body-m text-foreground-secondary">
                {gapUsd && spendableUsd !== undefined
                    ? t('fundingBodyGap', {
                          minimum: formatBankAmount(CARD_MIN_BALANCE_USD, 'USD'),
                          // a spendable balance rounds down (in whole units first: 0.29 * 100 is 28.999…)
                          balance: formatBankAmount(Math.floor(Math.round(spendableUsd * 1e6) / 1e4) / 100, 'USD'),
                          gap: formatBankAmount(gapUsd, 'USD'),
                      })
                    : t('fundingBody')}
            </p>
            {sent && !sentLanded && (
                <Callout priority="info" data-testid="card-add-money-bank-sent">
                    {sent.usd
                        ? tCard('bankSentPending', { amount: formatBankAmount(sent.usd, 'USD') })
                        : tCard('bankSentPendingNoAmount')}
                </Callout>
            )}
            <ListGroup>
                {bankOffered && bankRow}
                <ListItem
                    title={tAdd('methods.crypto')}
                    body={tAdd('methods.cryptoDescription')}
                    leading={<IconBubble {...CONCEPT_ICONS.crypto} size="s" />}
                    chevron
                    onClick={() => pickMethod('crypto')}
                    data-testid="card-add-money-crypto"
                />
                {!bankOffered && bankRow}
            </ListGroup>
            {drawer && (
                <CardAddMoneyDrawer
                    key={drawer.n}
                    open={open}
                    method={drawer.method}
                    gapUsd={gapUsd}
                    plan={plan}
                    residenceIso2s={readiness.residenceIso2s}
                    onShow={onShow}
                    onDismiss={dismiss}
                    onBankSent={bankSent}
                />
            )}
            <PageStack.Footer>
                <Button variant="primary" className="w-full" disabled={!funded} onClick={onContinue}>
                    {tCommon('continue')}
                </Button>
            </PageStack.Footer>
        </PageStack>
    )
}
