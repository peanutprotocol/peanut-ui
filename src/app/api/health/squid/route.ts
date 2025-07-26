import { fetchWithSentry } from '@/utils'
import { NextResponse } from 'next/server'

const SQUID_API_URL = process.env.NEXT_PUBLIC_SQUID_API_URL!
const SQUID_INTEGRATOR_ID = process.env.SQUID_INTEGRATOR_ID!
const DEFAULT_SQUID_INTEGRATOR_ID = process.env.DEFAULT_SQUID_INTEGRATOR_ID!
// || process.env.NEXT_PUBLIC_DEFAULT_SQUID_INTEGRATOR_ID

/**
 * Health check for Squid API
 * Tests both regular cross-chain routes and RFQ route availability
 */
export async function GET() {
    const startTime = Date.now()

    try {
        if (!SQUID_INTEGRATOR_ID && !DEFAULT_SQUID_INTEGRATOR_ID) {
            return NextResponse.json(
                {
                    status: 'unhealthy',
                    service: 'squid',
                    timestamp: new Date().toISOString(),
                    error: 'SQUID_INTEGRATOR_ID not configured',
                    responseTime: Date.now() - startTime,
                },
                { status: 500 }
            )
        }

        // Test 1: Regular route (ETH mainnet to Arbitrum USDC)
        const regularRouteTestStart = Date.now()
        const regularRouteParams = {
            fromChain: '1',
            fromToken: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', // ETH
            fromAmount: '1000000000000000000', // 1 ETH
            toChain: '42161',
            toToken: '0xaf88d065e77c8cc2239327c5edb3a432268e5831', // USDC on Arbitrum
            fromAddress: '0x8ba1f109551bd432803012645hac136c54fc8c58',
            toAddress: '0x8ba1f109551bd432803012645hac136c54fc8c58',
        }

        const regularRouteResponse = await fetchWithSentry(`${SQUID_API_URL}/v2/route`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-integrator-id': SQUID_INTEGRATOR_ID || DEFAULT_SQUID_INTEGRATOR_ID!,
            },
            body: JSON.stringify(regularRouteParams),
        })
        const regularRouteResponseTime = Date.now() - regularRouteTestStart

        if (!regularRouteResponse.ok) {
            throw new Error(`Regular route API returned ${regularRouteResponse.status}`)
        }

        const regularRouteData = await regularRouteResponse.json()
        if (!regularRouteData?.route) {
            throw new Error('Invalid regular route data structure')
        }

        // Test 2: RFQ route availability (using coral/RFQ integrator)
        const rfqRouteTestStart = Date.now()
        const rfqRouteResponse = await fetchWithSentry(`${SQUID_API_URL}/v2/route`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-integrator-id': SQUID_INTEGRATOR_ID!,
            },
            body: JSON.stringify(regularRouteParams),
        })
        const rfqRouteResponseTime = Date.now() - rfqRouteTestStart

        const rfqRouteHealthy = rfqRouteResponse.ok
        let rfqRouteData = null
        let hasRfqRoute = false

        if (rfqRouteHealthy) {
            try {
                rfqRouteData = await rfqRouteResponse.json()
                // Check if response contains RFQ-type route
                hasRfqRoute =
                    rfqRouteData?.route?.estimate?.route?.some(
                        (step: any) => step?.type === 'RFQ' || step?.protocol === 'RFQ'
                    ) || false
            } catch (e) {
                // If we can't parse the response, mark as degraded
            }
        }

        const totalResponseTime = Date.now() - startTime

        return NextResponse.json({
            status: 'healthy',
            service: 'squid',
            timestamp: new Date().toISOString(),
            responseTime: totalResponseTime,
            details: {
                regularRoutes: {
                    status: 'healthy',
                    responseTime: regularRouteResponseTime,
                    routeFound: !!regularRouteData.route,
                    estimatedGas: regularRouteData.route?.estimate?.gasLimit || 'unknown',
                },
                rfqRoutes: {
                    status: rfqRouteHealthy ? (hasRfqRoute ? 'healthy' : 'degraded') : 'unhealthy',
                    responseTime: rfqRouteResponseTime,
                    httpStatus: rfqRouteResponse.status,
                    rfqAvailable: hasRfqRoute,
                    message: hasRfqRoute ? 'RFQ routes available' : 'No RFQ routes found (may be normal)',
                },
            },
        })
    } catch (error) {
        const totalResponseTime = Date.now() - startTime

        return NextResponse.json(
            {
                status: 'unhealthy',
                service: 'squid',
                timestamp: new Date().toISOString(),
                error: error instanceof Error ? error.message : 'Unknown error',
                responseTime: totalResponseTime,
            },
            { status: 500 }
        )
    }
}
