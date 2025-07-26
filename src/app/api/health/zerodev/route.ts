import { fetchWithSentry } from '@/utils'
import { NextResponse } from 'next/server'

const BUNDLER_URL = process.env.NEXT_PUBLIC_ZERO_DEV_BUNDLER_URL
const PAYMASTER_URL = process.env.NEXT_PUBLIC_ZERO_DEV_PAYMASTER_URL
const POLYGON_BUNDLER_URL = process.env.NEXT_PUBLIC_POLYGON_BUNDLER_URL
const POLYGON_PAYMASTER_URL = process.env.NEXT_PUBLIC_POLYGON_PAYMASTER_URL

/**
 * Health check for ZeroDev services
 * Tests bundler and paymaster connectivity for both Arbitrum and Polygon
 */
export async function GET() {
    const startTime = Date.now()

    try {
        if (!BUNDLER_URL || !PAYMASTER_URL) {
            return NextResponse.json(
                {
                    status: 'unhealthy',
                    service: 'zerodev',
                    timestamp: new Date().toISOString(),
                    error: 'ZeroDev URLs not configured',
                    responseTime: Date.now() - startTime,
                },
                { status: 500 }
            )
        }

        const results: any = {
            arbitrum: {},
            polygon: {},
        }

        // Test Arbitrum Bundler
        const arbBundlerTestStart = Date.now()
        try {
            const arbBundlerResponse = await fetchWithSentry(BUNDLER_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'eth_supportedEntryPoints',
                    params: [],
                    id: 1,
                }),
            })

            results.arbitrum.bundler = {
                status: arbBundlerResponse.ok ? 'healthy' : 'unhealthy',
                responseTime: Date.now() - arbBundlerTestStart,
                httpStatus: arbBundlerResponse.status,
            }

            if (arbBundlerResponse.ok) {
                const bundlerData = await arbBundlerResponse.json()
                results.arbitrum.bundler.supportedEntryPoints = bundlerData?.result?.length || 0
            }
        } catch (error) {
            results.arbitrum.bundler = {
                status: 'unhealthy',
                responseTime: Date.now() - arbBundlerTestStart,
                error: error instanceof Error ? error.message : 'Unknown error',
            }
        }

        // Test Arbitrum Paymaster
        const arbPaymasterTestStart = Date.now()
        try {
            const arbPaymasterResponse = await fetchWithSentry(PAYMASTER_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'pm_supportedEntryPoints',
                    params: [],
                    id: 1,
                }),
            })

            results.arbitrum.paymaster = {
                status: arbPaymasterResponse.ok ? 'healthy' : 'unhealthy',
                responseTime: Date.now() - arbPaymasterTestStart,
                httpStatus: arbPaymasterResponse.status,
            }

            if (arbPaymasterResponse.ok) {
                const paymasterData = await arbPaymasterResponse.json()
                results.arbitrum.paymaster.supportedEntryPoints = paymasterData?.result?.length || 0
            }
        } catch (error) {
            results.arbitrum.paymaster = {
                status: 'unhealthy',
                responseTime: Date.now() - arbPaymasterTestStart,
                error: error instanceof Error ? error.message : 'Unknown error',
            }
        }

        // Test Polygon services if configured
        if (POLYGON_BUNDLER_URL && POLYGON_PAYMASTER_URL) {
            // Test Polygon Bundler
            const polyBundlerTestStart = Date.now()
            try {
                const polyBundlerResponse = await fetchWithSentry(POLYGON_BUNDLER_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        method: 'eth_supportedEntryPoints',
                        params: [],
                        id: 1,
                    }),
                })

                results.polygon.bundler = {
                    status: polyBundlerResponse.ok ? 'healthy' : 'unhealthy',
                    responseTime: Date.now() - polyBundlerTestStart,
                    httpStatus: polyBundlerResponse.status,
                }
            } catch (error) {
                results.polygon.bundler = {
                    status: 'unhealthy',
                    responseTime: Date.now() - polyBundlerTestStart,
                    error: error instanceof Error ? error.message : 'Unknown error',
                }
            }

            // Test Polygon Paymaster
            const polyPaymasterTestStart = Date.now()
            try {
                const polyPaymasterResponse = await fetchWithSentry(POLYGON_PAYMASTER_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        method: 'pm_supportedEntryPoints',
                        params: [],
                        id: 1,
                    }),
                })

                results.polygon.paymaster = {
                    status: polyPaymasterResponse.ok ? 'healthy' : 'unhealthy',
                    responseTime: Date.now() - polyPaymasterTestStart,
                    httpStatus: polyPaymasterResponse.status,
                }
            } catch (error) {
                results.polygon.paymaster = {
                    status: 'unhealthy',
                    responseTime: Date.now() - polyPaymasterTestStart,
                    error: error instanceof Error ? error.message : 'Unknown error',
                }
            }
        } else {
            results.polygon = {
                status: 'not_configured',
                message: 'Polygon ZeroDev services not configured',
            }
        }

        // Determine overall health
        const allServices = [
            results.arbitrum.bundler,
            results.arbitrum.paymaster,
            ...(results.polygon.bundler ? [results.polygon.bundler, results.polygon.paymaster] : []),
        ]

        const hasUnhealthyService = allServices.some((service) => service?.status === 'unhealthy')
        const overallStatus = hasUnhealthyService ? 'degraded' : 'healthy'

        const totalResponseTime = Date.now() - startTime

        return NextResponse.json({
            status: overallStatus,
            service: 'zerodev',
            timestamp: new Date().toISOString(),
            responseTime: totalResponseTime,
            details: results,
        })
    } catch (error) {
        const totalResponseTime = Date.now() - startTime

        return NextResponse.json(
            {
                status: 'unhealthy',
                service: 'zerodev',
                timestamp: new Date().toISOString(),
                error: error instanceof Error ? error.message : 'Unknown error',
                responseTime: totalResponseTime,
            },
            { status: 500 }
        )
    }
}
