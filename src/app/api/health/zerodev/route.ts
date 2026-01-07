import { NextResponse } from 'next/server'
import { fetchWithSentry } from '@/utils/sentry.utils'

/**
 * ZeroDev health check endpoint
 * Tests bundler and paymaster services for supported chains
 */
export async function GET() {
    const startTime = Date.now()

    try {
        // Get configuration from environment variables (same as zerodev.consts.ts)
        const BUNDLER_URL = process.env.NEXT_PUBLIC_ZERO_DEV_BUNDLER_URL
        const PAYMASTER_URL = process.env.NEXT_PUBLIC_ZERO_DEV_PAYMASTER_URL
        const PROJECT_ID = process.env.NEXT_PUBLIC_ZERO_DEV_PASSKEY_PROJECT_ID
        const POLYGON_BUNDLER_URL = process.env.NEXT_PUBLIC_POLYGON_BUNDLER_URL
        const POLYGON_PAYMASTER_URL = process.env.NEXT_PUBLIC_POLYGON_PAYMASTER_URL

        // Check configuration
        if (!BUNDLER_URL || !PAYMASTER_URL || !PROJECT_ID) {
            return NextResponse.json(
                {
                    status: 'unhealthy',
                    service: 'zerodev',
                    timestamp: new Date().toISOString(),
                    error: 'ZeroDev configuration missing (bundler, paymaster, or project ID)',
                    responseTime: Date.now() - startTime,
                },
                { status: 500 }
            )
        }

        const results: any = {
            arbitrum: {},
            polygon: {},
            configuration: {
                projectId: PROJECT_ID ? 'configured' : 'missing',
                bundlerUrl: BUNDLER_URL ? 'configured' : 'missing',
                paymasterUrl: PAYMASTER_URL ? 'configured' : 'missing',
                polygonBundlerUrl: POLYGON_BUNDLER_URL ? 'configured' : 'missing',
                polygonPaymasterUrl: POLYGON_PAYMASTER_URL ? 'configured' : 'missing',
            },
        }

        // Test Arbitrum endpoints
        await testChainEndpoints('arbitrum', BUNDLER_URL, PAYMASTER_URL, results)

        // Test Polygon endpoints (if configured)
        if (POLYGON_BUNDLER_URL && POLYGON_PAYMASTER_URL) {
            await testChainEndpoints('polygon', POLYGON_BUNDLER_URL, POLYGON_PAYMASTER_URL, results)
        } else {
            results.polygon = {
                status: 'not_configured',
                message: 'Polygon ZeroDev services not configured',
            }
        }

        // Determine overall status
        let overallStatus = 'healthy'
        const arbitrumHealthy =
            results.arbitrum.bundler?.status === 'healthy' && results.arbitrum.paymaster?.status === 'healthy'
        const polygonHealthy =
            results.polygon.status === 'not_configured' ||
            (results.polygon.bundler?.status === 'healthy' && results.polygon.paymaster?.status === 'healthy')

        if (!arbitrumHealthy || !polygonHealthy) {
            // If any critical service is down, mark as unhealthy
            overallStatus = 'unhealthy'
        }

        const responseTime = Date.now() - startTime

        // Return 500 if unhealthy
        if (overallStatus === 'unhealthy') {
            return NextResponse.json(
                {
                    status: overallStatus,
                    service: 'zerodev',
                    timestamp: new Date().toISOString(),
                    responseTime,
                    details: results,
                },
                { status: 500 }
            )
        }

        return NextResponse.json({
            status: overallStatus,
            service: 'zerodev',
            timestamp: new Date().toISOString(),
            responseTime,
            details: results,
        })
    } catch (error) {
        const responseTime = Date.now() - startTime

        return NextResponse.json(
            {
                status: 'unhealthy',
                service: 'zerodev',
                timestamp: new Date().toISOString(),
                error: error instanceof Error ? error.message : 'Unknown error',
                responseTime,
            },
            { status: 500 }
        )
    }
}

async function testChainEndpoints(chainName: string, bundlerUrl: string, paymasterUrl: string, results: any) {
    results[chainName] = {
        bundler: {},
        paymaster: {},
    }

    // Test Bundler - using a simple JSON-RPC call that bundlers should support
    const bundlerTestStart = Date.now()
    try {
        const bundlerResponse = await fetchWithSentry(bundlerUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'eth_chainId',
                params: [],
                id: 1,
            }),
        })

        results[chainName].bundler = {
            status: bundlerResponse.ok ? 'healthy' : 'unhealthy',
            responseTime: Date.now() - bundlerTestStart,
            httpStatus: bundlerResponse.status,
        }

        if (bundlerResponse.ok) {
            const bundlerData = await bundlerResponse.json()
            results[chainName].bundler.chainId = bundlerData?.result
        }
    } catch (error) {
        results[chainName].bundler = {
            status: 'unhealthy',
            responseTime: Date.now() - bundlerTestStart,
            error: error instanceof Error ? error.message : 'Unknown error',
        }
    }

    // Test Paymaster - using a simple JSON-RPC call
    const paymasterTestStart = Date.now()
    try {
        const paymasterResponse = await fetchWithSentry(paymasterUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'eth_chainId',
                params: [],
                id: 1,
            }),
        })

        results[chainName].paymaster = {
            status: paymasterResponse.status >= 200 && paymasterResponse.status < 503 ? 'healthy' : 'unhealthy', // 500 is expected for basic calls
            responseTime: Date.now() - paymasterTestStart,
            httpStatus: paymasterResponse.status,
        }

        if (paymasterResponse.ok) {
            const paymasterData = await paymasterResponse.json()
            results[chainName].paymaster.chainId = paymasterData?.result
        }
    } catch (error) {
        results[chainName].paymaster = {
            status: 'unhealthy',
            responseTime: Date.now() - paymasterTestStart,
            error: error instanceof Error ? error.message : 'Unknown error',
        }
    }
}
