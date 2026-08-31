import { useState, useEffect, useCallback, useRef } from 'react'
import { getCachedCurrencyPrice } from '@/app/actions/currency'

export const SYMBOLS_BY_CURRENCY_CODE: Record<string, string> = {
    ARS: 'ARS',
    USD: '$',
    EUR: '€',
    MXN: 'MX$',
    BRL: 'R$',
    COP: 'Col$',
    CRC: '₡',
    BOB: '$b',
    PUSD: 'PUSD',
    GTQ: 'Q',
    PHP: '₱',
    GBP: '£',
    JPY: '¥',
    CAD: 'CA$',
}

export const useCurrency = (currencyCode: string | null) => {
    const [code, setCode] = useState<string | null>(currencyCode?.toUpperCase() ?? null)
    const [symbol, setSymbol] = useState<string | null>(null)
    const [price, setPrice] = useState<{ buy: number; sell: number } | null>(null)
    const [isLoading, setIsLoading] = useState<boolean>(true)
    // Surfaces a failed FX fetch so consumers can render an error instead of
    // dereferencing a null price (which crashes the render). See useCurrency
    // consumers in the add-money / withdraw flows.
    const [isError, setIsError] = useState<boolean>(false)
    const [attempt, setAttempt] = useState<number>(0)

    // Lets a consumer re-run a failed fetch in place. Without it the effect only
    // re-runs when `code` changes, so a user who hits a rate outage is stuck on
    // the error state until they leave the screen and come back (#1848).
    const refetch = useCallback(() => setAttempt((n) => n + 1), [])

    /**
     * `code` seeds from the first render only, so without this the hook never
     * sees a later currency. Callers derive theirs from `useSearchParams()`,
     * which is empty on the first render of a statically exported page — the
     * hook would latch `null`, never fetch, and leave the withdraw screen on a
     * loader that never resolves (#1848).
     *
     * Tracking the previous prop (rather than syncing on every render) keeps the
     * unsupported-currency branch below, which deliberately nulls `code`, from
     * being overwritten on the next render.
     */
    const lastRequestedCode = useRef<string | null>(currencyCode?.toUpperCase() ?? null)
    const requestedCode = currencyCode?.toUpperCase() ?? null
    // The sync below only lands after this render commits. Reporting `isLoading`
    // during the gap keeps consumers from reading the not-yet-fetched code as a
    // settled "no rate" and flashing an error.
    const isSyncingCode = requestedCode !== lastRequestedCode.current

    useEffect(() => {
        if (requestedCode === lastRequestedCode.current) return
        lastRequestedCode.current = requestedCode
        setCode(requestedCode)
    }, [requestedCode])

    useEffect(() => {
        setIsError(false)
        if (!code) {
            setIsLoading(false)
            return
        }

        if (code === 'USD') {
            setSymbol(SYMBOLS_BY_CURRENCY_CODE[code])
            setPrice({ buy: 1, sell: 1 })
            setIsLoading(false)
            return
        }

        if (!Object.keys(SYMBOLS_BY_CURRENCY_CODE).includes(code)) {
            setCode(null)
            setIsLoading(false)
            return
        }

        // A slow request from a superseded code/attempt must not write its
        // result over the current one — on a flaky connection the responses can
        // land out of order, which would show the wrong currency's rate.
        let cancelled = false

        setIsLoading(true)
        getCachedCurrencyPrice(code)
            .then((price) => {
                if (cancelled) return
                setSymbol(SYMBOLS_BY_CURRENCY_CODE[code])
                setPrice(price)
                setIsLoading(false)
            })
            .catch((err) => {
                if (cancelled) return
                console.error(err)
                // Drop the previous currency's rate: keeping it would let a
                // consumer that gates on `price` alone price the new currency
                // with the old one's number.
                setSymbol(null)
                setPrice(null)
                setIsError(true)
                setIsLoading(false)
            })

        return () => {
            cancelled = true
        }
    }, [code, attempt])

    return {
        code,
        symbol,
        price,
        isLoading: isLoading || isSyncingCode,
        isError,
        refetch,
    }
}
