import { NextResponse } from 'next/server'

/**
 * ZeroDev health check endpoint
 * Tests bundler and paymaster services for Arbitrum (the only chain using ZeroDev in production).
 *
 * Uses `eth_supportedEntryPoints` for the bundler — this is a mandatory ERC-4337 method
 * that all compliant bundlers must support. Previous `eth_chainId` calls returned 400 on
 * some bundlers since it's not part of the ERC-4337 spec.
 *
 * Paymaster is tested with `eth_chainId` and treats any response < 503 as healthy,
 * since paymasters may return 400/500 for bare RPC calls while still being operational.
 *
 * Uses plain fetch (not fetchWithSentry) to avoid health check failures polluting Sentry.
 */
export async function GET() {
    const startTime = Date.now()

    try {
        const BUNDLER_URL = process.env.NEXT_PUBLIC_ZERO_DEV_BUNDLER_URL
        const PAYMASTER_URL = process.env.NEXT_PUBLIC_ZERO_DEV_PAYMASTER_URL
        const PROJECT_ID = process.env.NEXT_PUBLIC_ZERO_DEV_PASSKEY_PROJECT_ID

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
            arbitrum: { bundler: {}, paymaster: {} },
            configuration: {
                projectId: 'configured',
                bundlerUrl: 'configured',
                paymasterUrl: 'configured',
            },
        }

        // Test Arbitrum bundler with eth_supportedEntryPoints (mandatory ERC-4337 method)
        const bundlerTestStart = Date.now()
        try {
            const bundlerResponse = await fetch(BUNDLER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: AbortSignal.timeout(5000),
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'eth_supportedEntryPoints',
                    params: [],
                    id: 1,
                }),
            })

            const bundlerResponseTime = Date.now() - bundlerTestStart

            // Any HTTP response means the bundler is reachable.
            // 200 = fully healthy, 4xx = reachable but method issue (still alive), 5xx = server error
            if (bundlerResponse.ok) {
                const bundlerData = await bundlerResponse.json()
                results.arbitrum.bundler = {
                    status: 'healthy',
                    responseTime: bundlerResponseTime,
                    httpStatus: bundlerResponse.status,
                    entryPoints: bundlerData?.result,
                }
            } else if (bundlerResponse.status < 500) {
                // 4xx means the endpoint is reachable but rejected the call — degraded, not dead
                results.arbitrum.bundler = {
                    status: 'degraded',
                    responseTime: bundlerResponseTime,
                    httpStatus: bundlerResponse.status,
                    message: 'Bundler reachable but returned client error',
                }
            } else {
                results.arbitrum.bundler = {
                    status: 'unhealthy',
                    responseTime: bundlerResponseTime,
                    httpStatus: bundlerResponse.status,
                }
            }
        } catch (error) {
            results.arbitrum.bundler = {
                status: 'unhealthy',
                responseTime: Date.now() - bundlerTestStart,
                error: error instanceof Error ? error.message : 'Unknown error',
            }
        }

        // Test Arbitrum paymaster
        const paymasterTestStart = Date.now()
        try {
            const paymasterResponse = await fetch(PAYMASTER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: AbortSignal.timeout(5000),
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'eth_chainId',
                    params: [],
                    id: 1,
                }),
            })

            const paymasterResponseTime = Date.now() - paymasterTestStart

            // Paymaster often returns 400/500 for basic RPC calls — that's expected.
            // Only mark unhealthy if we can't reach it at all (503+) or network error.
            results.arbitrum.paymaster = {
                status: paymasterResponse.status < 503 ? 'healthy' : 'unhealthy',
                responseTime: paymasterResponseTime,
                httpStatus: paymasterResponse.status,
            }

            if (paymasterResponse.ok) {
                const paymasterData = await paymasterResponse.json()
                results.arbitrum.paymaster.chainId = paymasterData?.result
            }
        } catch (error) {
            results.arbitrum.paymaster = {
                status: 'unhealthy',
                responseTime: Date.now() - paymasterTestStart,
                error: error instanceof Error ? error.message : 'Unknown error',
            }
        }

        // Determine overall status — only Arbitrum matters for production
        const bundlerOk =
            results.arbitrum.bundler.status === 'healthy' || results.arbitrum.bundler.status === 'degraded'
        const paymasterOk = results.arbitrum.paymaster.status === 'healthy'

        let overallStatus = 'healthy'
        if (!bundlerOk || !paymasterOk) {
            overallStatus = 'unhealthy'
        } else if (results.arbitrum.bundler.status === 'degraded') {
            overallStatus = 'degraded'
        }

        const responseTime = Date.now() - startTime

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
        return NextResponse.json(
            {
                status: 'unhealthy',
                service: 'zerodev',
                timestamp: new Date().toISOString(),
                error: error instanceof Error ? error.message : 'Unknown error',
                responseTime: Date.now() - startTime,
            },
            { status: 500 }
        )
    }
}
