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
import { DEPOSIT_RAILS } from '@/features/deposit-accounts/rails'
import type { DepositCorridor } from '@/features/deposit-accounts/types'
import { useDepositAccountCopy } from '@/features/deposit-accounts/useDepositAccountCopy'
import { useDepositAccounts } from '@/features/deposit-accounts/useDepositAccounts'
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
    /** `fromBank`: opened from a bank status's crypto way out, so back returns to that status */
    | { kind: 'networks'; fromBank?: boolean }
    | { kind: 'address'; network: RhinoChainType; fromBank?: boolean }
    | { kind: 'bank' }
    /** an account picked from the bank list; a single account is the `bank` view itself */
    | { kind: 'details'; corridor: DepositCorridor }

/** What a bank view shows for this plan. */
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
            return 'not_offered'
    }
}

const STATUS_VIEWS: ReadonlySet<CardAddMoneyView> = new Set([
    'setting_up',
    'under_review',
    'not_verified',
    'finish_setup',
    'not_offered',
])

/**
 * Add money without leaving the card's funding step (TASK-25169): crypto by network and address,
 * bank by held details or the page that takes the transfer. Mounted once per opening, so the view
 * stays through the close animation and a new opening starts fresh.
 */
export function CardAddMoneyDrawer({
    open,
    method: openedWith,
    gapUsd,
    spendableUsd,
    plan,
    residenceIso2s,
    onShow,
    onDismiss,
    onBankSent,
}: {
    open: boolean
    method: CardFundingMethod
    gapUsd: number | undefined
    /** the live spendable balance, so a deposit view sees the money land */
    spendableUsd: number | undefined
    plan: CardBankPlan
    residenceIso2s: readonly string[]
    /** the method and view on screen, for the funded and closed events */
    onShow: (method: CardFundingMethod, view: CardAddMoneyView) => void
    /** the user closed the drawer: swipe, overlay or back */
    onDismiss: () => void
    /** "I've sent the transfer": the step shows the transfer on its way */
    onBankSent: (inDollars: boolean) => void
}) {
    const t = useTranslations('card.addMoney')
    const tAdd = useTranslations('addMoney')
    const router = useRouter()
    const [view, setView] = useState<DrawerView>(openedWith === 'crypto' ? { kind: 'networks' } : { kind: 'bank' })
    const [processing, setProcessing] = useState(false)

    const code: CardAddMoneyView =
        view.kind === 'bank' ? bankView(plan) : view.kind === 'details' ? 'details' : view.kind
    const method: CardFundingMethod = code === 'networks' || code === 'address' ? 'crypto' : 'bank'

    const reportedOpen = useRef(false)
    useEffect(() => {
        // the first real view: readiness still loading says nothing about what the user saw
        if (reportedOpen.current || code === 'loading') return
        reportedOpen.current = true
        captureCardAddMoneyDrawerOpened(method, code)
    }, [method, code])
    useEffect(() => onShow(method, code), [onShow, method, code])

    // One heading per view. Crypto and the lists: the gap (a network minimum above it is said in the
    // address body). One account's details: the account, named as the bank list names it, and the
    // amount in the currency sent is said in the body.
    const { accounts } = useDepositAccounts()
    const { t: tAccounts, accountRailName } = useDepositAccountCopy()
    const detailsCorridor =
        view.kind === 'details'
            ? view.corridor
            : code === 'details' && plan.kind === 'rows'
              ? plan.rows[0].corridor
              : null
    const title = detailsCorridor
        ? tAccounts('details.heading', {
              currency: DEPOSIT_RAILS[detailsCorridor].currency,
              rail: accountRailName(detailsCorridor, accounts[detailsCorridor]?.instructions),
          })
        : gapUsd
          ? t('title', { amount: formatBankAmount(gapUsd, 'USD') })
          : tAdd('title')
    const toNetworksFromBank = () => setView({ kind: 'networks', fromBank: true })
    const pickRow = (row: CardBankRow) => {
        captureCardAddMoneyRailPicked(row.corridor, row.kind)
        if (row.kind === 'account') setView({ kind: 'details', corridor: row.corridor })
        else router.push(cardBankPageHref(row.corridor, gapUsd, residenceIso2s))
    }

    const body = () => {
        if (view.kind === 'address')
            return (
                <CardCryptoDepositView
                    network={view.network}
                    gapUsd={gapUsd}
                    spendableUsd={spendableUsd}
                    onDone={onDismiss}
                    onProcessingChange={setProcessing}
                />
            )
        if (view.kind === 'details')
            return <CardBankDetailsView corridor={view.corridor} gapUsd={gapUsd} onSent={onBankSent} />
        if (code === 'networks') {
            return (
                <div className="flex flex-col gap-4">
                    <p className="text-body-m text-foreground-secondary">{t('pickNetwork')}</p>
                    <NetworkList
                        showEvmChips
                        onSelect={(network) => {
                            captureCardAddMoneyNetworkPicked(network)
                            setView({ kind: 'address', network, fromBank: view.kind === 'networks' && view.fromBank })
                        }}
                    />
                </div>
            )
        }
        switch (plan.kind) {
            case 'rows':
                return code === 'details' ? (
                    <CardBankDetailsView corridor={plan.rows[0].corridor} gapUsd={gapUsd} onSent={onBankSent} />
                ) : (
                    <CardBankRowsView rows={plan.rows} onPick={pickRow} />
                )
            case 'setting-up':
            case 'under-review':
            case 'not-verified':
            case 'finish-setup':
            case 'not-offered':
                return (
                    <CardBankStatusView
                        status={plan}
                        gapUsd={gapUsd}
                        onUseCrypto={toNetworksFromBank}
                        onVerify={() => {
                            captureCardAddMoneyVerifyTapped()
                            markVerifySource('card')
                            router.push('/verify')
                        }}
                        onFinishSetup={() =>
                            router.push(withReturnTo('/add-money?method=bank', CARD_FUNDING_RETURN_TO))
                        }
                        onChangeResidence={() =>
                            router.push(withReturnTo('/settings/details?open=residence', CARD_FUNDING_RETURN_TO))
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
    const subView = view.kind === 'address' || view.kind === 'details' || (view.kind === 'networks' && !!view.fromBank)
    const back = () => {
        if (view.kind === 'address') {
            setProcessing(false)
            setView({ kind: 'networks', fromBank: view.fromBank })
        } else setView({ kind: 'bank' })
    }
    // a status names itself in its own heading: the drawer title above it would be a second one
    const statusView = view.kind === 'bank' && STATUS_VIEWS.has(code)
    return (
        <Drawer open={open} onOpenChange={(isOpen) => !isOpen && onDismiss()}>
            <DrawerContent
                className="pb-4"
                accessibleTitle={subView || statusView ? title : undefined}
                data-testid="card-add-money-drawer"
            >
                <div className="flex flex-col gap-4">
                    {subView ? (
                        <NavHeader
                            title={title}
                            onPrev={back}
                            hideBackBtn={view.kind === 'address' && processing}
                            hideMaintenanceBanner
                        />
                    ) : statusView ? null : (
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
