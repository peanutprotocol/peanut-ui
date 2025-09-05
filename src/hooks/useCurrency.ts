import { useState, useEffect } from 'react'
import { getCurrencyPrice } from '@/app/actions/currency'

const SIMBOLS_BY_CURRENCY_CODE: Record<string, string> = {
    ARS: 'AR$',
    USD: '$',
    EUR: '€',
    MXN: 'MX$',
}

export const useCurrency = (currencyCode: string | null) => {
    const [code, setCode] = useState<string | null>(currencyCode?.toUpperCase() ?? null)
    const [symbol, setSymbol] = useState<string | null>(null)
    const [price, setPrice] = useState<number | null>(null)
    const [isLoading, setIsLoading] = useState<boolean>(false)

    useEffect(() => {
        if (!code) {
            setIsLoading(false)
            return
        }

        if (code === 'USD') {
            setSymbol('$')
            setPrice(1)
            setIsLoading(false)
            return
        }

        if (!Object.keys(SIMBOLS_BY_CURRENCY_CODE).includes(code)) {
            setCode(null)
            setIsLoading(false)
            return
        }

        setIsLoading(true)
        getCurrencyPrice(code)
            .then((price) => {
                setSymbol(SIMBOLS_BY_CURRENCY_CODE[code])
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
