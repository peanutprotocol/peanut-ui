'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import NetworkList from '@/components/AddMoney/components/NetworkList'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/Global/Drawer'
import Loading from '@/components/Global/Loading'
import NavHeader from '@/components/Global/NavHeader'
import {
    captureCardAddMoneyDrawerOpened,
    captureCardAddMoneyNetworkPicked,
    captureCardAddMoneyRailPicked,
    captureCardAddMoneyVerifyTapped,
    type CardAddMoneyView,
    type CardFundingMethod,
} from '@/features/card/card-gate-analytics'
import {
    CARD_FUNDING_RETURN_TO,
    cardBankPageHref,
    type CardBankPlan,
    type CardBankRow,
} from '@/features/card/cardAddMoney'
import type { DepositCorridor } from '@/features/deposit-accounts/types'
import { markVerifySource } from '@/features/paperwork-verification/verifySource'
import type { RhinoChainType } from '@/services/services.types'
import { formatBankAmount } from '@/utils/currency'
import { withReturnTo } from '@/utils/return-to.utils'
import { CardBankDetailsView } from './CardBankDetailsView'
import { CardBankRowsView } from './CardBankRowsView'
import { CardBankStatusView } from './CardBankStatusView'
import { CardCryptoDepositView } from './CardCryptoDepositView'

/** Where the drawer stands. `bank` follows the plan, so a plan that loads changes the view with it. */
type DrawerView =
    | { kind: 'networks' }
    | { kind: 'address'; network: RhinoChainType }
    | { kind: 'bank' }
    /** an account picked from the bank list; a single account is the `bank` view itself */
    | { kind: 'details'; corridor: DepositCorridor }

/** What a bank view shows for this plan. Nothing offered falls back to crypto: the bank row is hidden then. */
function bankView(plan: CardBankPlan): CardAddMoneyView {
    switch (plan.kind) {
        case 'loading':
            return 'loading'
        case 'rows':
            return plan.rows.length === 1 && plan.rows[0].kind === 'account' ? 'details' : 'rows'
        case 'setting-up':
            return 'setting_up'
        case 'under-review':
            return 'under_review'
        case 'not-verified':
            return 'not_verified'
        case 'finish-setup':
            return 'finish_setup'
        case 'not-offered':
            return 'networks'
    }
}

/**
 * Add money without leaving the card's funding step (TASK-25169): crypto by network and address,
 * bank by held details or the page that takes the transfer. Mounted once per opening, so the view
 * stays through the close animation and a new opening starts fresh.
 */
export function CardAddMoneyDrawer({
    open,
    method: openedWith,
    gapUsd,
    plan,
    residenceIso2s,
    onShow,
    onDismiss,
}: {
    open: boolean
    method: CardFundingMethod
    gapUsd: number | undefined
    plan: CardBankPlan
    residenceIso2s: readonly string[]
    /** the method and view on screen, for the funded and closed events */
    onShow: (method: CardFundingMethod, view: CardAddMoneyView) => void
    /** the user closed the drawer: swipe, overlay, back or "I've sent the transfer" */
    onDismiss: () => void
}) {
    const t = useTranslations('card.addMoney')
    const tAdd = useTranslations('addMoney')
    const router = useRouter()
    const [view, setView] = useState<DrawerView>(openedWith === 'crypto' ? { kind: 'networks' } : { kind: 'bank' })

    const code: CardAddMoneyView =
        view.kind === 'bank' ? bankView(plan) : view.kind === 'details' ? 'details' : view.kind
    const method: CardFundingMethod = code === 'networks' || code === 'address' ? 'crypto' : 'bank'

    const reportedOpen = useRef(false)
    useEffect(() => {
        if (reportedOpen.current) return
        reportedOpen.current = true
        captureCardAddMoneyDrawerOpened(method, code)
    }, [method, code])
    useEffect(() => onShow(method, code), [onShow, method, code])

    const title = gapUsd ? t('title', { amount: formatBankAmount(gapUsd, 'USD') }) : tAdd('title')
    const toNetworks = () => setView({ kind: 'networks' })
    const pickRow = (row: CardBankRow) => {
        captureCardAddMoneyRailPicked(row.corridor, row.kind)
        if (row.kind === 'account') setView({ kind: 'details', corridor: row.corridor })
        else router.push(cardBankPageHref(row.corridor, gapUsd, residenceIso2s))
    }

    const body = () => {
        if (view.kind === 'address') return <CardCryptoDepositView network={view.network} gapUsd={gapUsd} />
        if (view.kind === 'details')
            return <CardBankDetailsView corridor={view.corridor} gapUsd={gapUsd} onSent={onDismiss} />
        if (code === 'networks') {
            return (
                <div className="flex flex-col gap-4">
                    <p className="text-body-m text-foreground-secondary">{t('pickNetwork')}</p>
                    <NetworkList
                        showEvmChips
                        onSelect={(network) => {
                            captureCardAddMoneyNetworkPicked(network)
                            setView({ kind: 'address', network })
                        }}
                    />
                </div>
            )
        }
        switch (plan.kind) {
            case 'rows':
                return code === 'details' ? (
                    <CardBankDetailsView corridor={plan.rows[0].corridor} gapUsd={gapUsd} onSent={onDismiss} />
                ) : (
                    <CardBankRowsView rows={plan.rows} onPick={pickRow} />
                )
            case 'setting-up':
            case 'under-review':
            case 'not-verified':
            case 'finish-setup':
                return (
                    <CardBankStatusView
                        status={plan}
                        gapUsd={gapUsd}
                        onUseCrypto={toNetworks}
                        onVerify={() => {
                            captureCardAddMoneyVerifyTapped()
                            markVerifySource('card')
                            router.push('/verify')
                        }}
                        onFinishSetup={() =>
                            router.push(withReturnTo('/add-money?method=bank', CARD_FUNDING_RETURN_TO))
                        }
                    />
                )
            default:
                return (
                    <div className="flex justify-center py-10">
                        <Loading />
                    </div>
                )
        }
    }

    // a sub-view drills in from a list, so it gets the back control; a root view gets the title
    const subView = view.kind === 'address' || view.kind === 'details'
    return (
        <Drawer open={open} onOpenChange={(isOpen) => !isOpen && onDismiss()}>
            <DrawerContent
                className="pb-4"
                accessibleTitle={subView ? title : undefined}
                data-testid="card-add-money-drawer"
            >
                <div className="flex flex-col gap-4">
                    {subView ? (
                        <NavHeader
                            title={title}
                            onPrev={() => setView(view.kind === 'address' ? { kind: 'networks' } : { kind: 'bank' })}
                            hideMaintenanceBanner
                        />
                    ) : (
                        <DrawerTitle className="text-center text-heading-s text-foreground-primary">
                            {title}
                        </DrawerTitle>
                    )}
                    {body()}
                </div>
            </DrawerContent>
        </Drawer>
    )
}
