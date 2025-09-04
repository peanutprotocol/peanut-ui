import { useState, useEffect } from 'react'
import { getCurrencyPrice } from '@/app/actions/currency'

const SIMBOLS_BY_CURRENCY_CODE: Record<string, string> = {
    ARS: 'AR$',
    USD: '$',
    BRL: 'R$',
}

export const useCurrency = (currencyCode: string | null) => {
    const [code, setCode] = useState<string | null>(currencyCode?.toUpperCase() ?? null)
    const [symbol, setSymbol] = useState<string | null>(null)
    const [price, setPrice] = useState<number | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        if (!code) return

        if (code === 'USD') {
            setSymbol('$')
            setPrice(1)
            setIsLoading(false)
            return
        }

        // First iterations only pesos
        if (code !== 'ARS' && code !== 'BRL') {
            setCode(null)
            setIsLoading(false)
            return
        }

        getCurrencyPrice(code)
            .then((price) => {
                setSymbol(SIMBOLS_BY_CURRENCY_CODE[code])
                setPrice(price)
            })
            .catch(console.error)
            .finally(() => setIsLoading(false))
    }, [code])

    return {
        code,
        symbol,
        price,
        isLoading,
    }
}
