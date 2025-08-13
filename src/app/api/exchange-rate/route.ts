import { NextRequest, NextResponse } from 'next/server'

interface ExchangeRateResponse {
    rate: number
}

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams
        const from = searchParams.get('from')
        const to = searchParams.get('to')

        // Validate required parameters
        if (!from || !to) {
            return NextResponse.json({ error: 'Missing required parameters: from and to' }, { status: 400 })
        }

        const url = `https://api.frankfurter.app/latest?from=${from}&to=${to}`
        const options = {
            method: 'GET',
        }

        const response = await fetch(url, options)

        if (!response.ok) {
            console.error(`API error: ${response.status} ${response.statusText}`)
            return NextResponse.json({ error: 'Failed to fetch exchange rates from API' }, { status: response.status })
        }

        const data = await response.json()

        // Return structured exchange rate data
        const exchangeRate: ExchangeRateResponse = {
            rate: Number((data.rates[to] * 0.995).toFixed(3)), // subtract 50bps to match bridge's rate
        }

        return NextResponse.json(exchangeRate)
    } catch (error) {
        console.error('Exchange rate API error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
