'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/context/authContext'
import { useAddMoneyReadiness } from '@/features/add-money/useAddMoneyReadiness'
import { readStoredValue, removeStoredValue, writeStoredValue } from '@/utils/safe-storage'
import { AddMoneyDrawer } from './AddMoneyDrawer'
import { addMoneyGapUsd, drawerBankPlan } from './addMoneyDrawerPlan'
import {
    captureAddMoneyCameBackFunded,
    captureAddMoneyDrawerClosed,
    type AddMoneyDrawerView,
    type DrawerMethod,
    type AddMoneyPlace,
} from './drawerAnalytics'

/**
 * "Add $X" for a place outside the card (TASK-25467): the gap to the place's target, the drawer
 * opened on the choice of methods, and the "on its way" note after a bank transfer. The place keeps
 * its own error and button; once the balance covers the target the drawer closes and the place's
 * button turns on. Nothing here ever submits a payment.
 */
/**
 * Where a bank page or /verify sends the user back to: the place's URL with its step state, read as
 * that route opens, not at the tap, so an amount edited after opening the drawer comes back too.
 */
const currentUrl = () => window.location.pathname + window.location.search

export function useAddMoneyAction({
    place,
    targetUsd,
    spendableUsd,
    step,
}: {
    place: AddMoneyPlace
    /**
     * The step's identity, from what its route already holds (Send: recipient and amount): a transfer
     * sent for one step is not shown on another. Never personal data beyond the route.
     */
    step: string
    /** the spendable balance the place needs, in dollars */
    targetUsd: number
    /** the place's spendable balance in dollars; undefined while it loads */
    spendableUsd: number | undefined
}) {
    const readiness = useAddMoneyReadiness(false)
    const { user } = useAuth()
    const userId = user?.user?.userId
    const plan = drawerBankPlan({ ...readiness, identityStatus: user?.identityVerification?.status })
    const gapUsd = addMoneyGapUsd(targetUsd, spendableUsd)
    const funded = gapUsd === 0

    // one drawer per opening (`n` remounts it), kept mounted closed through vaul's exit animation
    const [n, setN] = useState(0)
    const [open, setOpen] = useState(false)
    const shown = useRef<{ method: DrawerMethod | null; view: AddMoneyDrawerView } | null>(null)
    const onShow = useCallback((method: DrawerMethod | null, view: AddMoneyDrawerView) => {
        shown.current = { method, view }
    }, [])
    const dismiss = useCallback(() => {
        if (shown.current) captureAddMoneyDrawerClosed(place, shown.current.method, shown.current.view)
        setOpen(false)
    }, [place])

    // Before/after: the target the user tapped "Add $X" for, kept in session storage so a user who
    // funds on a bank page and comes back counts too. The tapped target, not the live one: an amount
    // lowered after the tap is not money added.
    const shortKey = `${place}_add_money_short_v1:${userId ?? ''}`
    const openAddMoney = () => {
        writeStoredValue(shortKey, String(targetUsd), 'sessionStorage')
        shown.current = null
        setN((last) => last + 1)
        setOpen(true)
    }
    useEffect(() => {
        const tapped = Number(readStoredValue(shortKey, 'sessionStorage'))
        if (!tapped || addMoneyGapUsd(tapped, spendableUsd) !== 0) return
        removeStoredValue(shortKey, 'sessionStorage')
        captureAddMoneyCameBackFunded(place, open, shown.current?.method ?? null)
    }, [shortKey, spendableUsd, place, open])

    // funded with the drawer open: back to the step, whose own button is now on
    useEffect(() => {
        if (funded && open) setOpen(false)
    }, [funded, open])

    // "I've sent the transfer": back to the step with the transfer named on it until the balance covers
    // the target. No backend call and no push outside the card (Kush, TASK-25467 decision 2). Session
    // storage keeps it for the app session, like the card's hold (Kush, 2026-11-27): it survives a
    // refresh and coming back to the same step, and a changed step or a funded one drops it.
    const sentKey = `${place}_add_money_bank_sent_v1:${userId ?? ''}`
    const [bankSent, setBankSent] = useState<{ usd: number | null }>()
    const onBankSent = (inDollars: boolean) => {
        dismiss()
        if (!gapUsd) return
        const next = { usd: inDollars ? gapUsd : null }
        setBankSent(next)
        writeStoredValue(sentKey, JSON.stringify({ step, ...next }), 'sessionStorage')
    }
    useEffect(() => {
        let stored: { step?: string; usd?: number | null } | null = null
        try {
            stored = JSON.parse(readStoredValue(sentKey, 'sessionStorage') ?? 'null')
        } catch {
            // a broken entry is no transfer
        }
        if (stored && stored.step === step && !funded) {
            setBankSent({ usd: stored.usd ?? null })
            return
        }
        setBankSent(undefined)
        if (stored) removeStoredValue(sentKey, 'sessionStorage')
    }, [sentKey, step, funded])

    const drawer =
        n > 0 ? (
            <AddMoneyDrawer
                key={n}
                open={open}
                targetUsd={targetUsd}
                funded={funded}
                gapUsd={gapUsd}
                plan={plan}
                residenceIso2s={readiness.residenceIso2s}
                returnTo={currentUrl}
                place={place}
                onShow={onShow}
                onDismiss={dismiss}
                onBankSent={onBankSent}
            />
        ) : null

    return { gapUsd, openAddMoney, bankSent: funded ? undefined : bankSent, drawer }
}
