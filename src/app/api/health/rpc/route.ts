import { NextResponse } from 'next/server'
import { rpcUrls } from '@/constants/general.consts'

const INFURA_API_KEY = process.env.NEXT_PUBLIC_INFURA_API_KEY
const ALCHEMY_API_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY

/**
 * Health check for RPC providers across key chains.
 *
 * Critical chains (Ethereum, Arbitrum) failing → system unhealthy.
 * Non-critical chains (Polygon) failing → system degraded (not unhealthy).
 *
 * Uses plain fetch to avoid polluting Sentry with expected health check failures.
 */

// Chains that must be healthy for the system to be considered healthy.
// If a critical chain has zero healthy providers, overall status = unhealthy.
const CRITICAL_CHAINS = new Set([1, 42161]) // Ethereum, Arbitrum

export async function GET() {
    const startTime = Date.now()

    try {
        if (!INFURA_API_KEY && !ALCHEMY_API_KEY) {
            return NextResponse.json(
                {
                    status: 'unhealthy',
                    service: 'rpc',
                    timestamp: new Date().toISOString(),
                    error: 'No RPC API keys configured',
                    responseTime: Date.now() - startTime,
                },
                { status: 500 }
            )
        }

        const chainResults: any = {}

        const chainsToTest = [
            { id: 1, name: 'ethereum' },
            { id: 42161, name: 'arbitrum' },
            { id: 137, name: 'polygon' },
        ]

        // Test all chains in parallel for faster response
        await Promise.all(
            chainsToTest.map(async (chain) => {
                const chainRpcs = rpcUrls[chain.id] || []
                chainResults[chain.name] = {
                    chainId: chain.id,
                    critical: CRITICAL_CHAINS.has(chain.id),
                    providers: {},
                    overallStatus: 'unknown',
                }

                // Test all providers for this chain in parallel
                await Promise.all(
                    chainRpcs.map(async (rpcUrl, i) => {
                        const providerName = rpcUrl.includes('infura')
                            ? 'infura'
                            : rpcUrl.includes('alchemy')
                              ? 'alchemy'
                              : rpcUrl.includes('chainstack')
                                ? 'chainstack'
                                : rpcUrl.includes('publicnode')
                                  ? 'publicnode'
                                  : rpcUrl.includes('ankr')
                                    ? 'ankr'
                                    : rpcUrl.includes('bnbchain')
                                      ? 'binance'
                                      : `provider_${i}`

                        const rpcTestStart = Date.now()

                        try {
                            const response = await fetch(rpcUrl, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    jsonrpc: '2.0',
                                    method: 'eth_blockNumber',
                                    params: [],
                                    id: 1,
                                }),
                                signal: AbortSignal.timeout(5000), // 5s per provider
                            })

                            const responseTime = Date.now() - rpcTestStart

                            if (response.ok) {
                                const data = await response.json()
                                const blockNumber = data?.result ? parseInt(data.result, 16) : null

                                chainResults[chain.name].providers[providerName] = {
                                    status: blockNumber ? 'healthy' : 'degraded',
                                    responseTime,
                                    blockNumber,
                                    url: sanitizeUrl(rpcUrl),
                                }
                            } else {
                                chainResults[chain.name].providers[providerName] = {
                                    status: 'unhealthy',
                                    responseTime,
                                    httpStatus: response.status,
                                    url: sanitizeUrl(rpcUrl),
                                }
                            }
                        } catch (error) {
                            chainResults[chain.name].providers[providerName] = {
                                status: 'unhealthy',
                                responseTime: Date.now() - rpcTestStart,
                                error: error instanceof Error ? error.message : 'Unknown error',
                                url: sanitizeUrl(rpcUrl),
                            }
                        }
                    })
                )

                // Determine chain overall status
                const chainProviders = Object.values(chainResults[chain.name].providers) as any[]
                const healthyCount = chainProviders.filter((p) => p.status === 'healthy').length
                const degradedCount = chainProviders.filter((p) => p.status === 'degraded').length
                const unhealthyCount = chainProviders.length - healthyCount - degradedCount

                if (healthyCount > 0) {
                    chainResults[chain.name].overallStatus = 'healthy'
                } else if (degradedCount > 0) {
                    chainResults[chain.name].overallStatus = 'degraded'
                } else {
                    chainResults[chain.name].overallStatus = 'unhealthy'
                }

                chainResults[chain.name].summary = {
                    total: chainProviders.length,
                    healthy: healthyCount,
                    degraded: degradedCount,
                    unhealthy: unhealthyCount,
                }
            })
        )

        // Determine overall status with critical vs non-critical distinction
        let overallStatus = 'healthy'
        let hasCriticalFailure = false
        let hasNonCriticalFailure = false

        for (const chain of chainsToTest) {
            const status = chainResults[chain.name].overallStatus
            if (status === 'unhealthy') {
                if (CRITICAL_CHAINS.has(chain.id)) {
                    hasCriticalFailure = true
                } else {
                    hasNonCriticalFailure = true
                }
            }
        }

        if (hasCriticalFailure) {
            overallStatus = 'unhealthy'
        } else if (hasNonCriticalFailure) {
            overallStatus = 'degraded'
        }

        const totalResponseTime = Date.now() - startTime

        const responseCode = overallStatus === 'unhealthy' ? 500 : 200

        return NextResponse.json(
            {
                status: overallStatus,
                service: 'rpc',
                timestamp: new Date().toISOString(),
                responseTime: totalResponseTime,
                details: {
                    chains: chainResults,
                    configuration: {
                        infuraConfigured: !!INFURA_API_KEY,
                        alchemyConfigured: !!ALCHEMY_API_KEY,
                    },
                },
            },
            { status: responseCode }
        )
    } catch (error) {
        const totalResponseTime = Date.now() - startTime

        return NextResponse.json(
            {
                status: 'unhealthy',
                service: 'rpc',
                timestamp: new Date().toISOString(),
                error: error instanceof Error ? error.message : 'Unknown error',
                responseTime: totalResponseTime,
            },
            { status: 500 }
        )
    }
}

/** Strip API keys from URLs for safe logging */
function sanitizeUrl(url: string): string {
    return url
        .replace(/\/v3\/[a-f0-9]+/g, '/v3/***') // Infura
        .replace(/\/v2\/[a-zA-Z0-9_-]+/g, '/v2/***') // Alchemy
        .replace(/\/[a-f0-9]{32,}/g, '/***') // Chainstack and other hex keys
        .replace(/(api_key|api-key|apikey)=[^&]+/g, '$1=***')
}
