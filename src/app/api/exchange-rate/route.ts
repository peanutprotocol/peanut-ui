import { NextRequest, NextResponse } from 'next/server'

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

        const pairKey = `${fromUc}-${toUc}`
        const reversePairKey = `${toUc}-${fromUc}`

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
    } catch (error) {
        console.error('Exchange rate API error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
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
