import { NextResponse } from 'next/server'
import { mantecaApi } from '@/services/manteca'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

/**
 * Health check for Manteca API
 * Tests connectivity through backend to Manteca by fetching USDC/ARS prices
 * Doesn't really guarantee ALL manteca functionality works, but it's a good canary
 */
export async function GET() {
    const startTime = Date.now()

    try {
        // Test Manteca connectivity by fetching prices using the mantecaApi service
        // Using USDC/ARS as a standard test case
        const mantecaTestStart = Date.now()
        const priceData = await mantecaApi.getPrices({ asset: 'USDC', against: 'ARS' })
        const mantecaResponseTime = Date.now() - mantecaTestStart

        const totalResponseTime = Date.now() - startTime

        // Verify the response has expected structure
        if (!priceData || typeof priceData.buy === 'undefined' || typeof priceData.sell === 'undefined') {
            throw new Error('Manteca API returned unexpected response format')
        }

        return NextResponse.json(
            {
                status: 'healthy',
                service: 'manteca',
                timestamp: new Date().toISOString(),
                responseTime: totalResponseTime,
                details: {
                    apiConnectivity: {
                        status: 'healthy',
                        responseTime: mantecaResponseTime,
                        testMethod: 'mantecaApi.getPrices({ asset: "USDC", against: "ARS" })',
                        message: 'Manteca API responding normally',
                        priceDataValid: true,
                    },
                },
            },
            {
                status: 200,
                headers: {
                    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                    Pragma: 'no-cache',
                    Expires: '0',
                    'Surrogate-Control': 'no-store',
                },
            }
        )
    } catch (error) {
        const totalResponseTime = Date.now() - startTime

        return NextResponse.json(
            {
                status: 'unhealthy',
                service: 'manteca',
                timestamp: new Date().toISOString(),
                error: error instanceof Error ? error.message : 'Unknown error',
                responseTime: totalResponseTime,
            },
            {
                status: 500,
                headers: {
                    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                    Pragma: 'no-cache',
                    Expires: '0',
                    'Surrogate-Control': 'no-store',
                },
            }
        )
    }
}
