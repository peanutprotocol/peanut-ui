'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { PageStack } from '@/components/0_Bruddle/PageStack'
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
import { cardBankPageHref, cardBankPlan, cardGapUsd } from '@/features/card/cardAddMoney'
import { formatBankAmount } from '@/utils/currency'
import { CardAddMoneyDrawer } from './CardAddMoneyDrawer'

/**
 * The card's $10 step. Bank and Crypto open the add-money drawer in place, so the step never
 * unmounts while the user adds money, and the drawer closes itself once the balance covers it.
 */
export function CardFundingStep({
    funded,
    balanceKnown,
    spendableUsd,
    onPrev,
    onContinue,
}: {
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

    const pickMethod = (method: CardFundingMethod) => {
        captureCardGateAddFundsTapped('funding', funded, method)
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

    // Before/after for the drawer: the balance reached the minimum after this step showed it short.
    const sawShort = useRef(false)
    const reportedFunded = useRef(false)
    useEffect(() => {
        if (!balanceKnown) return
        if (!funded) {
            sawShort.current = true
            return
        }
        if (!sawShort.current || reportedFunded.current) return
        reportedFunded.current = true
        captureCardGateCameBackFunded(open, shown.current?.method ?? drawer?.method ?? null)
    }, [funded, balanceKnown, open, drawer])

    useEffect(() => {
        if (!funded || !open) return
        setOpen(false)
        onContinue()
    }, [funded, open, onContinue])

    const bankShown = plan.kind !== 'not-offered'
    return (
        <PageStack>
            <NavHeader title={t('navTitle')} onPrev={onPrev} />
            <h1 className="text-heading-s text-foreground-primary">{tAdd('title')}</h1>
            <p className="text-body-m text-foreground-secondary">
                {gapUsd && spendableUsd !== undefined
                    ? t('fundingBodyGap', {
                          // a spendable balance rounds down, so it never shows more than can be spent
                          balance: formatBankAmount(Math.floor(spendableUsd * 100) / 100, 'USD'),
                          gap: formatBankAmount(gapUsd, 'USD'),
                      })
                    : t('fundingBody')}
            </p>
            <ListGroup>
                {bankShown && (
                    <ListItem
                        title={tAdd('methods.bankTransfer')}
                        body={tAdd('methods.bankTransferDescription')}
                        leading={<IconBubble {...CONCEPT_ICONS.bank} size="s" />}
                        chevron
                        onClick={() => pickMethod('bank')}
                        data-testid="card-add-money-bank"
                    />
                )}
                <ListItem
                    title={tAdd('methods.crypto')}
                    body={tAdd('methods.cryptoDescription')}
                    leading={<IconBubble {...CONCEPT_ICONS.crypto} size="s" />}
                    chevron
                    onClick={() => pickMethod('crypto')}
                    data-testid="card-add-money-crypto"
                />
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
