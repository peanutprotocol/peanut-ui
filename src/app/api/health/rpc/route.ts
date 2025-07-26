import { fetchWithSentry } from '@/utils'
import { NextResponse } from 'next/server'
import { rpcUrls } from '@/constants/general.consts'

const INFURA_API_KEY = process.env.NEXT_PUBLIC_INFURA_API_KEY
const ALCHEMY_API_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY

/**
 * Health check for RPC providers (Infura, Alchemy)
 * Tests connectivity across multiple chains
 */
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

        // Test key chains: Ethereum mainnet, Arbitrum, Polygon
        const chainsToTest = [
            { id: 1, name: 'ethereum' },
            { id: 42161, name: 'arbitrum' },
            { id: 137, name: 'polygon' },
        ]

        for (const chain of chainsToTest) {
            const chainRpcs = rpcUrls[chain.id] || []
            chainResults[chain.name] = {
                chainId: chain.id,
                providers: {},
                overallStatus: 'unknown',
            }

            for (let i = 0; i < chainRpcs.length; i++) {
                const rpcUrl = chainRpcs[i]
                const providerName = rpcUrl.includes('infura')
                    ? 'infura'
                    : rpcUrl.includes('alchemy')
                      ? 'alchemy'
                      : rpcUrl.includes('bnbchain')
                        ? 'binance'
                        : `provider_${i}`

                const rpcTestStart = Date.now()

                try {
                    const response = await fetchWithSentry(rpcUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            jsonrpc: '2.0',
                            method: 'eth_blockNumber',
                            params: [],
                            id: 1,
                        }),
                    })

                    const responseTime = Date.now() - rpcTestStart

                    if (response.ok) {
                        const data = await response.json()
                        const blockNumber = data?.result ? parseInt(data.result, 16) : null

                        chainResults[chain.name].providers[providerName] = {
                            status: blockNumber ? 'healthy' : 'degraded',
                            responseTime,
                            blockNumber,
                            url: rpcUrl.replace(/(api_key|api-key)=[^&]+/g, 'api_key=***'), // Hide API key
                        }
                    } else {
                        chainResults[chain.name].providers[providerName] = {
                            status: 'unhealthy',
                            responseTime,
                            httpStatus: response.status,
                            url: rpcUrl.replace(/(api_key|api-key)=[^&]+/g, 'api_key=***'),
                        }
                    }
                } catch (error) {
                    chainResults[chain.name].providers[providerName] = {
                        status: 'unhealthy',
                        responseTime: Date.now() - rpcTestStart,
                        error: error instanceof Error ? error.message : 'Unknown error',
                        url: rpcUrl.replace(/(api_key|api-key)=[^&]+/g, 'api_key=***'),
                    }
                }
            }

            // Determine chain overall status
            const chainProviders = Object.values(chainResults[chain.name].providers)
            const healthyProviders = chainProviders.filter((p: any) => p.status === 'healthy')
            const degradedProviders = chainProviders.filter((p: any) => p.status === 'degraded')

            if (healthyProviders.length > 0) {
                chainResults[chain.name].overallStatus = 'healthy'
            } else if (degradedProviders.length > 0) {
                chainResults[chain.name].overallStatus = 'degraded'
            } else {
                chainResults[chain.name].overallStatus = 'unhealthy'
            }

            chainResults[chain.name].summary = {
                total: chainProviders.length,
                healthy: healthyProviders.length,
                degraded: degradedProviders.length,
                unhealthy: chainProviders.length - healthyProviders.length - degradedProviders.length,
            }
        }

        // Determine overall RPC health
        const chainStatuses = Object.values(chainResults).map((chain: any) => chain.overallStatus)
        const hasUnhealthyChain = chainStatuses.includes('unhealthy')
        const hasDegradedChain = chainStatuses.includes('degraded')

        let overallStatus = 'healthy'
        if (hasUnhealthyChain) {
            overallStatus = 'unhealthy'
        } else if (hasDegradedChain) {
            overallStatus = 'degraded'
        }

        // If any critical chain is unhealthy, return HTTP 500
        if (overallStatus === 'unhealthy') {
            throw new Error(`Critical RPC providers unavailable. Chains status: ${chainStatuses.join(', ')}`)
        }

        const totalResponseTime = Date.now() - startTime

        return NextResponse.json({
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
        })
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
