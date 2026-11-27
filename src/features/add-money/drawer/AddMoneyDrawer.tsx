'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { ListGroup } from '@/components/0_Bruddle/ListGroup'
import NetworkList from '@/components/AddMoney/components/NetworkList'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/Global/Drawer'
import Loading from '@/components/Global/Loading'
import NavHeader from '@/components/Global/NavHeader'
import type { DepositCorridor } from '@/features/deposit-accounts/types'
import { markVerifySource } from '@/features/paperwork-verification/verifySource'
import type { RhinoChainType } from '@/services/services.types'
import { withReturnTo } from '@/utils/return-to.utils'
import { bankPageHref, type DrawerBankPlan, type DrawerBankRow } from './addMoneyDrawerPlan'
import { BankMethodRow } from './BankMethodRow'
import { CryptoMethodRow } from './CryptoMethodRow'
import { DrawerBankDetailsView } from './DrawerBankDetailsView'
import { DrawerBankRowsView } from './DrawerBankRowsView'
import { DrawerBankStatusView } from './DrawerBankStatusView'
import { DrawerCryptoDepositView } from './DrawerCryptoDepositView'
import {
    captureAddMoneyDrawerOpened,
    captureAddMoneyNetworkPicked,
    captureAddMoneyRailPicked,
    captureAddMoneyVerifyTapped,
    type AddMoneyDrawerView,
    type AddMoneyMethod,
    type AddMoneyPlace,
} from './drawerAnalytics'
import { useBankMethodState } from './useBankMethodState'

/**
 * Where the drawer stands. `bank` and `methods` follow the plan, so a plan that loads changes the
 * view with them. `prev`: the view this one was opened from, so back returns to it; a view without
 * one is the drawer's root and gets the title instead.
 */
type DrawerView = DrawerStep & { prev?: DrawerView }
type DrawerStep =
    /** crypto and the bank ways side by side, for a place that opens the drawer with no method */
    | { kind: 'methods' }
    | { kind: 'networks' }
    | { kind: 'address'; network: RhinoChainType }
    | { kind: 'bank' }
    /** an account picked from a bank list; a single account is the `bank` view itself */
    | { kind: 'details'; corridor: DepositCorridor }

/** What a bank view shows for this plan. */
function bankView(plan: DrawerBankPlan): AddMoneyDrawerView {
    switch (plan.kind) {
        // the place disables the bank row for a bank being set up or reviewed: no drawer opens on them
        case 'loading':
        case 'setting-up':
        case 'under-review':
            return 'loading'
        case 'rows':
            return plan.rows.length === 1 && plan.rows[0].kind === 'account' ? 'details' : 'rows'
        case 'not-verified':
            return 'not_verified'
        case 'finish-setup':
            return 'finish_setup'
        case 'not-offered':
            return 'not_offered'
    }
}

/**
 * Add money without leaving the place that needs it (TASK-25169, shared in TASK-25467): crypto by
 * network and address, bank by held details or the page that takes the transfer. Mounted once per
 * opening, so the view stays through the close animation and a new opening starts fresh.
 */
export function AddMoneyDrawer({
    open,
    method: openedWith,
    targetUsd,
    gapUsd,
    plan,
    residenceIso2s,
    returnTo,
    place,
    onShow,
    onDismiss,
    onBankSent,
}: {
    open: boolean
    /** the method the place picked; without one the drawer opens on the choice of methods */
    method?: AddMoneyMethod
    /** the spendable balance the place needs: each view reads the balance fresh and asks for the gap to it */
    targetUsd: number
    /** the place's cached gap, only to prefill a bank page's amount field */
    gapUsd: number | undefined
    plan: DrawerBankPlan
    residenceIso2s: readonly string[]
    /** where /verify, finish-setup and bank pages send the user back to */
    returnTo: string
    /** names the analytics events and the verify source */
    place: AddMoneyPlace
    /** the method and view on screen, for the funded and closed events */
    onShow: (method: AddMoneyMethod | null, view: AddMoneyDrawerView) => void
    /** the user closed the drawer: swipe, overlay or back */
    onDismiss: () => void
    /** "I've sent the transfer": the place shows the transfer on its way */
    onBankSent: (inDollars: boolean) => void
}) {
    const t = useTranslations('card.addMoney')
    const tAdd = useTranslations('addMoney')
    const router = useRouter()
    const [view, setView] = useState<DrawerView>({
        kind: openedWith === 'crypto' ? 'networks' : openedWith === 'bank' ? 'bank' : 'methods',
    })
    const [processing, setProcessing] = useState(false)
    const bank = useBankMethodState(plan)

    // proposal Q1: with bank not usable now, crypto is the only way, so the choice opens on the networks;
    // until bank is known the choice waits, so it never shows a row it then takes away
    const code: AddMoneyDrawerView =
        view.kind === 'methods'
            ? bank.unknown
                ? 'loading'
                : bank.blocked
                  ? 'networks'
                  : 'methods'
            : view.kind === 'bank'
              ? bankView(plan)
              : view.kind
    const method: AddMoneyMethod | null =
        code === 'networks' || code === 'address' ? 'crypto' : view.kind === 'methods' ? null : 'bank'

    const reportedOpen = useRef(false)
    useEffect(() => {
        // the first real view: readiness still loading says nothing about what the user saw
        if (reportedOpen.current || code === 'loading') return
        reportedOpen.current = true
        captureAddMoneyDrawerOpened(place, method, code)
    }, [place, method, code])
    useEffect(() => onShow(method, code), [onShow, method, code])

    // One title across every step, the status views too (design.md: one title per flow), with no
    // amount: the body names what to send (the gap, a network minimum above it, or euros), so the two
    // biggest amounts on screen never disagree. A status names itself in body text under it.
    const title = tAdd('title')
    const pickRow = (row: DrawerBankRow) => {
        captureAddMoneyRailPicked(place, row.corridor, row.kind)
        if (row.kind === 'account') setView({ kind: 'details', corridor: row.corridor, prev: view })
        else router.push(bankPageHref(row.corridor, gapUsd, residenceIso2s, returnTo))
    }
    const toNetworks = () => setView({ kind: 'networks', prev: view })

    const details = (corridor: DepositCorridor) => (
        <DrawerBankDetailsView corridor={corridor} targetUsd={targetUsd} returnTo={returnTo} onSent={onBankSent} />
    )

    const body = () => {
        if (view.kind === 'address')
            return (
                <DrawerCryptoDepositView
                    network={view.network}
                    targetUsd={targetUsd}
                    place={place}
                    onDone={onDismiss}
                    onProcessingChange={setProcessing}
                />
            )
        if (view.kind === 'details') return details(view.corridor)
        if (code === 'networks') {
            return (
                <div className="flex flex-col gap-4">
                    <p className="text-body-m text-foreground-secondary">{t('pickNetwork')}</p>
                    <NetworkList
                        showEvmChips
                        onSelect={(network) => {
                            captureAddMoneyNetworkPicked(place, network)
                            setView({ kind: 'address', network, prev: view })
                        }}
                    />
                </div>
            )
        }
        if (code === 'methods') {
            const crypto = <CryptoMethodRow onClick={toNetworks} testId="add-money-method-crypto" />
            // ready bank ways are rows of their own; otherwise one bank row says why, as on the card
            return plan.kind === 'rows' ? (
                <DrawerBankRowsView rows={plan.rows} onPick={pickRow}>
                    {crypto}
                </DrawerBankRowsView>
            ) : (
                <ListGroup>
                    <BankMethodRow
                        bank={bank}
                        onClick={() => setView({ kind: 'bank', prev: view })}
                        testId="add-money-method-bank"
                    />
                    {crypto}
                </ListGroup>
            )
        }
        switch (plan.kind) {
            case 'rows':
                return code === 'details' ? (
                    details(plan.rows[0].corridor)
                ) : (
                    <DrawerBankRowsView rows={plan.rows} onPick={pickRow} />
                )
            case 'not-verified':
            case 'finish-setup':
            case 'not-offered':
                return (
                    <DrawerBankStatusView
                        status={plan}
                        onUseCrypto={toNetworks}
                        onVerify={() => {
                            captureAddMoneyVerifyTapped(place)
                            markVerifySource(place)
                            // option B (Kush): the check ends back on the place that opened the drawer
                            router.push(withReturnTo('/verify', returnTo))
                        }}
                        onFinishSetup={() => router.push(withReturnTo('/add-money?method=bank', returnTo))}
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
    const subView = !!view.prev
    const back = () => {
        setProcessing(false)
        if (view.prev) setView(view.prev)
    }
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
                            onPrev={back}
                            hideBackBtn={view.kind === 'address' && processing}
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
