'use client'

import { useCallback, useEffect, useState } from 'react'
import { parseUsdAmount } from './amount-validation'

interface MantecaAmountSeedInput {
    /** the user-editable ?amount= (USD) handed over by the shared amount step */
    urlAmount: string
    /** local currency per 1 USD — the same sell rate AmountInput's primary denomination uses */
    currencyPriceSell: number | undefined
    /** the flow's current URL step */
    step: string
    /**
     * Synchronous balance/minimum verdict for a USD amount string. Must return
     * false while the balance is still loading. Synchronous on purpose: the
     * page's balanceErrorMessage is effect-set and lags the seeded amount by a
     * render, which would let the seed outrun the gate it enforces.
     */
    isAmountAllowed: (usd: string) => boolean
    limitsLoading: boolean
    limitsBlocking: boolean
    setUsdAmount: (usd: string) => void
    setCurrencyAmount: (local: string) => void
    goToBankDetails: () => void
}

/**
 * TASK-21664: the shared /withdraw amount step already collected the USD
 * amount — honor it: seed both denominations and skip this flow's own amount
 * entry. But `?amount=` is user-editable and the amount screen is where the
 * balance floor/ceiling and the async LATAM limits block — so the seed only
 * ADVANCES once those gates pass for the seeded amount (Chip review round 3).
 * A blocked amount stays on the amount screen, which renders the reason
 * (limits card / balance error).
 *
 * `seededFromUrl` drives back-navigation: a seeded flow returns to the ROOT
 * amount step, not to a second amount entry. `resetSeed` (Try again after a
 * terminal failure) re-arms the seed so the flow re-enters bank-details
 * instead of dead-ending on an empty amount screen.
 */
export function useMantecaAmountSeed({
    urlAmount,
    currencyPriceSell,
    step,
    isAmountAllowed,
    limitsLoading,
    limitsBlocking,
    setUsdAmount,
    setCurrencyAmount,
    goToBankDetails,
}: MantecaAmountSeedInput): { seededFromUrl: boolean; resetSeed: () => void } {
    // State, not refs: the gate-clear and Try-again re-arm cases must re-run
    // these effects, and a ref flip re-runs nothing.
    const [seedState, setSeedState] = useState<'idle' | 'seeded' | 'advanced'>('idle')

    // seed the denominations once per arm. parseUsdAmount is fail-closed: a
    // finite positive PLAIN decimal or nothing — an exponential `?amount=1e21`
    // used to survive a bare parseFloat check, normalize to '1e+21', and crash
    // the live-balance validator's parseUnits call (Chip round 7).
    useEffect(() => {
        if (seedState !== 'idle') return
        if (!urlAmount || !currencyPriceSell) return
        if (step !== 'amount') return
        const normalized = parseUsdAmount(urlAmount)
        if (normalized === null) return
        const usd = Number(normalized)
        setSeedState('seeded')
        setUsdAmount(usd.toFixed(2))
        // currencyPriceSell = local currency per 1 USD (the review row renders
        // `1 USD = <sell> <currency>`); this direction must match AmountInput's
        // primary denomination price or the two entries would disagree
        setCurrencyAmount((usd * currencyPriceSell).toFixed(2))
    }, [seedState, urlAmount, currencyPriceSell, step, setUsdAmount, setCurrencyAmount])

    // advance past the amount screen only when its gates pass for the seeded
    // amount — a blocked amount stays and shows why. All gates are synchronous
    // against the render's live values (limits validation is a useMemo over
    // the amount; isAmountAllowed reads the live balance), so the seed can
    // never advance on a stale verdict.
    useEffect(() => {
        if (seedState !== 'seeded') return
        if (step !== 'amount') return
        if (limitsLoading || limitsBlocking) return
        const normalized = parseUsdAmount(urlAmount)
        if (normalized === null) return
        if (!isAmountAllowed(Number(normalized).toFixed(2))) return
        setSeedState('advanced')
        goToBankDetails()
    }, [seedState, step, urlAmount, isAmountAllowed, limitsLoading, limitsBlocking, goToBankDetails])

    const resetSeed = useCallback(() => setSeedState('idle'), [])

    return { seededFromUrl: seedState !== 'idle', resetSeed }
}
