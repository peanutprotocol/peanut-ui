import { fetchWithSentry } from '@/utils/sentry.utils'
import { NextResponse } from 'next/server'

const MOBULA_API_URL = process.env.MOBULA_API_URL!
const MOBULA_API_KEY = process.env.MOBULA_API_KEY!

/**
 * Health check for Mobula API
 * Tests both asset price endpoint and portfolio endpoint
 */
export async function GET() {
    const startTime = Date.now()

    try {
        if (!MOBULA_API_KEY) {
            return NextResponse.json(
                {
                    status: 'unhealthy',
                    service: 'mobula',
                    timestamp: new Date().toISOString(),
                    error: 'MOBULA_API_KEY not configured',
                    responseTime: Date.now() - startTime,
                },
                { status: 500 }
            )
        }

        // Test 1: Asset price endpoint (using USDC on Ethereum as test)
        const priceTestStart = Date.now()
        const priceResponse = await fetchWithSentry(
            `${MOBULA_API_URL}/api/1/market/data?asset=0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48&blockchain=1`,
            {
                headers: {
                    'Content-Type': 'application/json',
                    authorization: MOBULA_API_KEY,
                },
            }
        )
        const priceResponseTime = Date.now() - priceTestStart

        if (!priceResponse.ok) {
            throw new Error(`Price API returned ${priceResponse.status}`)
        }

        const priceData = await priceResponse.json()
        if (!priceData?.data?.price) {
            throw new Error('Invalid price data structure')
        }

        // Test 2: Portfolio endpoint (using a known address with likely balance)
        const portfolioTestStart = Date.now()
        const portfolioResponse = await fetchWithSentry(
            `${MOBULA_API_URL}/api/1/wallet/portfolio?wallet=0x9647BB6a598c2675310c512e0566B60a5aEE6261`,
            {
                headers: {
                    'Content-Type': 'application/json',
                    authorization: MOBULA_API_KEY,
                },
            }
        )
        const portfolioResponseTime = Date.now() - portfolioTestStart

        const portfolioHealthy = portfolioResponse.ok

        // If portfolio API is down, throw error to return HTTP 500
        if (!portfolioHealthy) {
            throw new Error(`Portfolio API returned ${portfolioResponse.status}`)
        }

        const totalResponseTime = Date.now() - startTime

        return NextResponse.json({
            status: 'healthy',
            service: 'mobula',
            timestamp: new Date().toISOString(),
            responseTime: totalResponseTime,
            details: {
                priceApi: {
                    status: 'healthy',
                    responseTime: priceResponseTime,
                    testAsset: 'USDC',
                    price: priceData.data.price,
                },
                portfolioApi: {
                    status: 'healthy',
                    responseTime: portfolioResponseTime,
                    httpStatus: portfolioResponse.status,
                },
            },
        })
    } catch (error) {
        const totalResponseTime = Date.now() - startTime

        return NextResponse.json(
            {
                status: 'unhealthy',
                service: 'mobula',
                timestamp: new Date().toISOString(),
                error: error instanceof Error ? error.message : 'Unknown error',
                responseTime: totalResponseTime,
            },
            { status: 500 }
        )
    }
}
