import { useState, useEffect } from 'react'
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

        setIsLoading(true)
        getCachedCurrencyPrice(code)
            .then((price) => {
                setSymbol(SYMBOLS_BY_CURRENCY_CODE[code])
                setPrice(price)
                setIsLoading(false)
            })
            .catch((err) => {
                console.error(err)
                setIsError(true)
                setIsLoading(false)
            })
    }, [code])

    return {
        code,
        symbol,
        price,
        isLoading,
        isError,
    }
}
