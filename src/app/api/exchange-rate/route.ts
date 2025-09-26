import { NextRequest, NextResponse } from 'next/server'
import { mantecaApi } from '@/services/manteca'

interface ExchangeRateResponse {
    rate: number
}

interface BridgeExchangeRateResponse {
    midmarket_rate: string
    buy_rate: string
    sell_rate: string
}

// Currency pairs that should use Bridge API (USD to these currencies only)
const BRIDGE_PAIRS = new Set(['USD-EUR', 'USD-MXN', 'USD-BRL'])

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
            const reversePairKey = `${toUc}-${fromUc}`

            // Check if either currency is a LATAM currency that uses Manteca
            if (MANTECA_CURRENCIES.has(fromUc) || MANTECA_CURRENCIES.has(toUc)) {
                const mantecaRate = await fetchFromManteca(fromUc, toUc)
                if (mantecaRate !== null) {
                    return NextResponse.json(
                        { rate: mantecaRate },
                        {
                            headers: {
                                'Cache-Control': 's-maxage=300, stale-while-revalidate=600',
                            },
                        }
                    )
                }
                // Fall back to other providers if Manteca fails
                console.warn(`Manteca failed for ${pairKey}, falling back to other providers`)
            }

            // Check if we should use Bridge for this pair or its reverse
            const shouldUseBridge = BRIDGE_PAIRS.has(pairKey)
            const shouldUseBridgeReverse = BRIDGE_PAIRS.has(reversePairKey)

            if (shouldUseBridge || shouldUseBridgeReverse) {
                // For Bridge pairs, we need to determine which rate to use
                let bridgeResult
                if (shouldUseBridge) {
                    // Direct pair (e.g., USD→EUR): use sell_rate
                    bridgeResult = await fetchFromBridge(fromUc, toUc, 'sell_rate', false)
                } else {
                    // Reverse pair (e.g., EUR→USD): fetch USD→EUR and use buy_rate, then invert
                    bridgeResult = await fetchFromBridge(toUc, fromUc, 'buy_rate', true)
                }

                if (bridgeResult) {
                    return bridgeResult
                }
                // Fall back to Frankfurter if Bridge fails
                console.warn(`Bridge failed for ${pairKey}, falling back to Frankfurter`)
            }

            // Use Frankfurter for all other pairs or as fallback
            return await fetchFromFrankfurter(fromUc, toUc)
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
        const pairKey = `${from}-${to}`
        const reversePairKey = `${to}-${from}`

        // Check if either currency is a LATAM currency that uses Manteca
        if (MANTECA_CURRENCIES.has(from) || MANTECA_CURRENCIES.has(to)) {
            return await fetchFromManteca(from, to)
        }

        // Check if we should use Bridge for this pair or its reverse
        const shouldUseBridge = BRIDGE_PAIRS.has(pairKey)
        const shouldUseBridgeReverse = BRIDGE_PAIRS.has(reversePairKey)

        if (shouldUseBridge || shouldUseBridgeReverse) {
            // For Bridge pairs, we need to determine which rate to use
            let bridgeResult
            if (shouldUseBridge) {
                // Direct pair (e.g., USD→EUR): use sell_rate
                bridgeResult = await fetchFromBridge(from, to, 'sell_rate', false)
            } else {
                // Reverse pair (e.g., EUR→USD): fetch USD→EUR and use buy_rate, then invert
                bridgeResult = await fetchFromBridge(to, from, 'buy_rate', true)
            }

            if (bridgeResult) {
                const data = await bridgeResult.json()
                return data.rate
            }
            // Fall back to Frankfurter if Bridge fails
            console.warn(`Bridge failed for ${pairKey}, falling back to Frankfurter`)
        }

        // Use Frankfurter for all other pairs or as fallback
        const frankfurterResult = await fetchFromFrankfurter(from, to)
        const data = await frankfurterResult.json()
        return data.rate
    } catch (error) {
        console.error(`Failed to get exchange rate for ${from}-${to}:`, error)
        return null
    }
}

async function fetchFromManteca(from: string, to: string): Promise<number | null> {
    console.log('Fetching from manteca')
    try {
        // Manteca API provides rates against USDC, so we need to handle different scenarios
        if (from === 'USD' && MANTECA_CURRENCIES.has(to)) {
            // USD → LATAM currency: use sell rate (selling USD to get LATAM currency)
            const response = await mantecaApi.getPrices({ asset: 'USDC', against: to })
            return Number(response.effectiveSell)
        } else if (MANTECA_CURRENCIES.has(from) && to === 'USD') {
            // LATAM currency → USD: use buy rate (buying USD with LATAM currency)
            const response = await mantecaApi.getPrices({ asset: 'USDC', against: from })
            return 1 / Number(response.effectiveBuy)
        } else if (MANTECA_CURRENCIES.has(from) && MANTECA_CURRENCIES.has(to)) {
            // LATAM currency → LATAM currency: convert through USD
            const fromResponse = await mantecaApi.getPrices({ asset: 'USDC', against: from })
            const toResponse = await mantecaApi.getPrices({ asset: 'USDC', against: to })

            // from → USD → to
            const fromToUsd = 1 / Number(fromResponse.effectiveBuy)
            const usdToTo = Number(toResponse.effectiveSell)
            return fromToUsd * usdToTo
        } else {
            // One currency is LATAM, the other is not USD - this shouldn't happen in our flow
            // but we'll return null to fall back to other providers
            console.warn(`Unsupported Manteca conversion: ${from} → ${to}`)
            return null
        }
    } catch (error) {
        console.error(`Manteca API error for ${from}-${to}:`, error)
        return null
    }
}

async function fetchFromBridge(
    from: string,
    to: string,
    rateType: 'buy_rate' | 'sell_rate',
    shouldInvert: boolean
): Promise<NextResponse | null> {
    const bridgeAPIKey = process.env.BRIDGE_API_KEY

    if (!bridgeAPIKey) {
        console.warn('Bridge API key not set')
        return null
    }

    try {
        const url = `https://api.bridge.xyz/v0/exchange_rates?from=${from.toLowerCase()}&to=${to.toLowerCase()}`
        const options: RequestInit & { next?: { revalidate?: number } } = {
            method: 'GET',
            // Bridge expects header name 'Api-Key'
            headers: { 'Api-Key': bridgeAPIKey },
            next: { revalidate: 300 }, // Cache for 5 minutes
        }

        const response = await fetch(url, options)

        if (!response.ok) {
            console.error(`Bridge API error: ${response.status} ${response.statusText}`)
            return null
        }

        const bridgeData: BridgeExchangeRateResponse = await response.json()

        // Validate the response structure
        if (!bridgeData[rateType]) {
            console.error(`Invalid Bridge response: missing ${rateType}`)
            return null
        }

        let rate = parseFloat(bridgeData[rateType])

        // If we fetched the reverse pair (e.g., fetched USD→EUR for EUR→USD request),
        // we need to invert the rate
        if (shouldInvert) {
            rate = 1 / rate
        }

        const exchangeRate: ExchangeRateResponse = {
            rate,
        }

        return NextResponse.json(exchangeRate, {
            headers: {
                'Cache-Control': 's-maxage=300, stale-while-revalidate=600',
            },
        })
    } catch (error) {
        console.error('Bridge API exception:', error)
        return null
    }
}

async function fetchFromFrankfurter(from: string, to: string): Promise<NextResponse> {
    const url = `https://api.frankfurter.app/latest?from=${from}&to=${to}`
    const options: RequestInit & { next?: { revalidate?: number } } = {
        method: 'GET',
        next: { revalidate: 300 }, // Cache for 5 minutes
    }

    const response = await fetch(url, options)

    if (!response.ok) {
        console.error(`Frankfurter API error: ${response.status} ${response.statusText}`)
        return NextResponse.json({ error: 'Failed to fetch exchange rates from API' }, { status: response.status })
    }

    const data = await response.json()

    const exchangeRate: ExchangeRateResponse = {
        rate: data.rates[to] * 0.995, // Subtract 50bps
    }

    return NextResponse.json(exchangeRate, {
        headers: {
            'Cache-Control': 's-maxage=300, stale-while-revalidate=600',
        },
    })
}
