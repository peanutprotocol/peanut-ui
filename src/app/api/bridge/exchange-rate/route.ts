import { NextRequest, NextResponse } from 'next/server'

// Bridge API response interface
interface BridgeExchangeRateResponse {
    midmarket_rate: string
    buy_rate: string
    sell_rate: string
}

// Our API response interface
interface ExchangeRateResponse {
    from: string
    to: string
    rates: {
        midmarket: number
        buy: number
        sell: number
    }
}

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams
        const from = searchParams.get('from')
        const to = searchParams.get('to')

        const bridgeAPIKey = process.env.BRIDGE_API_KEY

        if (!bridgeAPIKey) {
            return NextResponse.json({ error: 'Bridge API key is not set' }, { status: 500 })
        }

        // Validate required parameters
        if (!from || !to) {
            return NextResponse.json({ error: 'Missing required parameters: from and to' }, { status: 400 })
        }

        const url = `https://api.bridge.xyz/v0/exchange_rates?from=${from}&to=${to}`
        const options = {
            method: 'GET',
            headers: { 'Api-Key': bridgeAPIKey },
        }

        const response = await fetch(url, options)

        if (!response.ok) {
            console.error(`Bridge API error: ${response.status} ${response.statusText}`)
            return NextResponse.json(
                { error: 'Failed to fetch exchange rates from Bridge API' },
                { status: response.status }
            )
        }

        const bridgeData: BridgeExchangeRateResponse = await response.json()

        // Validate the response structure
        if (!bridgeData.midmarket_rate || !bridgeData.buy_rate || !bridgeData.sell_rate) {
            console.error('Invalid response structure from Bridge API:', bridgeData)
            return NextResponse.json({ error: 'Invalid response from Bridge API' }, { status: 502 })
        }

        // Return structured exchange rate data
        const exchangeRate: ExchangeRateResponse = {
            from: from.toUpperCase(),
            to: to.toUpperCase(),
            rates: {
                midmarket: parseFloat(bridgeData.midmarket_rate),
                buy: parseFloat(bridgeData.buy_rate),
                sell: parseFloat(bridgeData.sell_rate),
            },
        }

        return NextResponse.json(exchangeRate)
    } catch (error) {
        console.error('Exchange rate API error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
