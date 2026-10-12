'use client'

import { useCallback, useEffect, useState } from 'react'
import { parseUsdAmount } from './amount-validation'

/** Preserve an incoming amount without skipping destination or amount validation. */
export function useMantecaAmountSeed({
    urlAmount,
    currencyPriceSell,
    setUsdAmount,
    setCurrencyAmount,
}: {
    urlAmount: string
    currencyPriceSell: number | undefined
    setUsdAmount: (usd: string) => void
    setCurrencyAmount: (local: string) => void
}) {
    const [seeded, setSeeded] = useState(false)
    useEffect(() => {
        if (seeded || !currencyPriceSell) return
        const normalized = parseUsdAmount(urlAmount)
        if (normalized === null) return
        setSeeded(true)
        setUsdAmount(Number(normalized).toFixed(2))
        setCurrencyAmount((Number(normalized) * currencyPriceSell).toFixed(2))
    }, [seeded, urlAmount, currencyPriceSell, setUsdAmount, setCurrencyAmount])
    const resetSeed = useCallback(() => setSeeded(false), [])
    return { resetSeed }
}
