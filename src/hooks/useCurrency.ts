import { useState, useEffect } from 'react'
import { getCurrencyPrice } from '@/app/actions/currency'

export const SYMBOLS_BY_CURRENCY_CODE: Record<string, string> = {
    ARS: 'AR$',
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

    useEffect(() => {
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
        getCurrencyPrice(code)
            .then((price) => {
                setSymbol(SYMBOLS_BY_CURRENCY_CODE[code])
                setPrice(price)
                setIsLoading(false)
            })
            .catch((err) => {
                console.error(err)
                setIsLoading(false)
            })
    }, [code])

    return {
        code,
        symbol,
        price,
        isLoading,
    }
}
