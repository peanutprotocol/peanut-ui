import { NextRequest, NextResponse } from 'next/server'
import { getCurrencyPrice } from '@/app/actions/currency'

interface ExchangeRateResponse {
    rate: number
}

// LATAM currencies that should use Manteca API
const MANTECA_CURRENCIES = new Set(['ARS', 'BRL', 'COP', 'CRC', 'PUSD', 'GTQ', 'PHP', 'BOB'])

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams
        const from = searchParams.get('from')
        const to = searchParams.get('to')

        // Validate required parameters
        if (!from || !to) {
            return NextResponse.json({ error: 'Missing required parameters: from and to' }, { status: 400 })
        }

        const fromUc = from.toUpperCase()
        const toUc = to.toUpperCase()

        // Same-currency pair: return 1:1 immediately
        if (fromUc === toUc) {
            return NextResponse.json(
                { rate: 1 },
                {
                    headers: {
                        'Cache-Control': 's-maxage=300, stale-while-revalidate=600',
                    },
                }
            )
        }

        // If either currency is USD, handle direct conversion
        if (fromUc === 'USD' || toUc === 'USD') {
            const pairKey = `${fromUc}-${toUc}`

            // Check if either currency uses getCurrencyPrice (Manteca or Bridge currencies)
            if (
                MANTECA_CURRENCIES.has(fromUc) ||
                MANTECA_CURRENCIES.has(toUc) ||
                ['EUR', 'MXN'].includes(fromUc) ||
                ['EUR', 'MXN'].includes(toUc)
            ) {
                const currencyPriceRate = await fetchFromCurrencyPrice(fromUc, toUc)
                if (currencyPriceRate !== null) {
                    return NextResponse.json(
                        { rate: currencyPriceRate },
                        {
                            headers: {
                                'Cache-Control': 's-maxage=300, stale-while-revalidate=600',
                            },
                        }
                    )
                }
                // Fall back to other providers if getCurrencyPrice fails
                console.warn(`getCurrencyPrice failed for ${pairKey}, falling back to other providers`)
            }

            // Use Frankfurter for all other pairs or as fallback
            const frankfurterRate = await fetchFromFrankfurter(fromUc, toUc)
            if (frankfurterRate !== null) {
                return NextResponse.json(
                    { rate: frankfurterRate },
                    {
                        headers: {
                            'Cache-Control': 's-maxage=300, stale-while-revalidate=600',
                        },
                    }
                )
            }
            return NextResponse.json({ error: 'Failed to fetch exchange rates' }, { status: 500 })
        }

        // For non-USD pairs, convert through USD: from → USD → to
        const fromToUsdRate = await getExchangeRate(fromUc, 'USD')
        const usdToToRate = await getExchangeRate('USD', toUc)

        if (!fromToUsdRate || !usdToToRate) {
            return NextResponse.json({ error: 'Failed to fetch intermediate USD rates' }, { status: 500 })
        }

        const combinedRate = fromToUsdRate * usdToToRate

        return NextResponse.json(
            { rate: combinedRate },
            {
                headers: {
                    'Cache-Control': 's-maxage=300, stale-while-revalidate=600',
                },
            }
        )
    } catch (error) {
        console.error('Exchange rate API error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

async function getExchangeRate(from: string, to: string): Promise<number | null> {
    try {
        // Check if either currency uses getCurrencyPrice (Manteca or Bridge currencies)
        if (
            MANTECA_CURRENCIES.has(from) ||
            MANTECA_CURRENCIES.has(to) ||
            ['EUR', 'MXN'].includes(from) ||
            ['EUR', 'MXN'].includes(to)
        ) {
            return await fetchFromCurrencyPrice(from, to)
        }

        // Use Frankfurter for all other pairs or as fallback
        return await fetchFromFrankfurter(from, to)
    } catch (error) {
        console.error(`Failed to get exchange rate for ${from}-${to}:`, error)
        return null
    }
}

async function fetchFromCurrencyPrice(from: string, to: string): Promise<number | null> {
    console.log('Fetching from getCurrencyPrice')
    try {
        if (from === 'USD' && (MANTECA_CURRENCIES.has(to) || ['EUR', 'MXN'].includes(to))) {
            // USD → other currency: use sell rate (selling USD to get other currency)
            const { sell } = await getCurrencyPrice(to)
            if (!isFinite(sell) || sell <= 0) {
                console.error(`Invalid sell rate from getCurrencyPrice for ${to}: ${sell}`)
                return null
            }
            return sell
        } else if ((MANTECA_CURRENCIES.has(from) || ['EUR', 'MXN'].includes(from)) && to === 'USD') {
            // Other currency → USD: use buy rate (buying USD with other currency)
            const { buy } = await getCurrencyPrice(from)
            if (!isFinite(buy) || buy <= 0) {
                console.error(`Invalid buy rate from getCurrencyPrice for ${from}: ${buy}`)
                return null
            }
            return 1 / buy
        } else if (
            (MANTECA_CURRENCIES.has(from) || ['EUR', 'MXN'].includes(from)) &&
            (MANTECA_CURRENCIES.has(to) || ['EUR', 'MXN'].includes(to))
        ) {
            // Other currency → Other currency: convert through USD
            const fromPrices = await getCurrencyPrice(from)
            const toPrices = await getCurrencyPrice(to)

            if (!isFinite(fromPrices.buy) || fromPrices.buy <= 0 || !isFinite(toPrices.sell) || toPrices.sell <= 0) {
                console.error(`Invalid prices for ${from}-${to}: buy=${fromPrices.buy}, sell=${toPrices.sell}`)
                return null
            }

            // from → USD → to
            const fromToUsd = 1 / fromPrices.buy
            const usdToTo = toPrices.sell
            return fromToUsd * usdToTo
        } else {
            // Unsupported conversion
            console.warn(`Unsupported getCurrencyPrice conversion: ${from} → ${to}`)
            return null
        }
    } catch (error) {
        console.error(`getCurrencyPrice error for ${from}-${to}:`, error)
        return null
    }
}

async function fetchFromFrankfurter(from: string, to: string): Promise<number | null> {
    try {
        // If either currency is USD, do direct conversion
        if (from === 'USD' || to === 'USD') {
            return await fetchDirectFromFrankfurter(from, to)
        }

        // For non-USD pairs, convert through USD: from → USD → to
        const fromToUsdRate = await fetchDirectFromFrankfurter(from, 'USD')
        const usdToToRate = await fetchDirectFromFrankfurter('USD', to)

        if (!fromToUsdRate || !usdToToRate) {
            return null
        }

        return fromToUsdRate * usdToToRate
    } catch (error) {
        console.error(`Frankfurter API exception for ${from}-${to}:`, error)
        return null
    }
}

async function fetchDirectFromFrankfurter(from: string, to: string): Promise<number | null> {
    try {
        const url = `https://api.frankfurter.app/latest?from=${from}&to=${to}`
        const options: RequestInit & { next?: { revalidate?: number } } = {
            method: 'GET',
            next: { revalidate: 300 }, // Cache for 5 minutes
        }

        const response = await fetch(url, options)

        if (!response.ok) {
            console.error(`Frankfurter API error: ${response.status} ${response.statusText}`)
            return null
        }

        const data = await response.json()
        return data.rates[to] * 0.995 // Subtract 50bps
    } catch (error) {
        console.error(`Frankfurter direct API exception for ${from}-${to}:`, error)
        return null
    }
}
