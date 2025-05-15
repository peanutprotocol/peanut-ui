import { useState, useEffect } from 'react'
import { getCurrencyPrice } from '@/app/actions/currency'

const SIMBOLS_BY_CURRENCY_CODE: Record<string, string> = {
    ARS: 'AR$',
    USD: '$',
}

export const useCurrency = (currencyCode: string | null) => {
    const [code, setCode] = useState<string | null>(currencyCode?.toUpperCase() ?? null)
    const [symbol, setSymbol] = useState<string | null>(null)
    const [price, setPrice] = useState<number | null>(null)

    useEffect(() => {
        if (!code) return

        if (code === 'USD') {
            setSymbol('$')
            setPrice(1)
            return
        }

        // First iterations only pesos
        if (code !== 'ARS') {
            setCode(null)
            return
        }

        getCurrencyPrice(code)
            .then((price) => {
                setSymbol(SIMBOLS_BY_CURRENCY_CODE[code])
                setPrice(price)
            })
            .catch(console.error)
    }, [code])

    return {
        code,
        symbol,
        price,
    }
}
