import { NextResponse } from 'next/server'
import { fetchWithSentry } from '@/utils'

/**
 * Overall health check endpoint
 * Aggregates health status from all individual service health checks
 */
export async function GET() {
    const startTime = Date.now()

    try {
        const services = ['mobula', 'squid', 'zerodev', 'rpc', 'bridge', 'backend']

        const healthChecks = await Promise.allSettled(
            services.map(async (service) => {
                const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://peanut.to'
                const response = await fetchWithSentry(`${baseUrl}/api/health/${service}`, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                })

                if (!response.ok) {
                    throw new Error(`Health check failed with status ${response.status}`)
                }

                const data = await response.json()
                return {
                    service,
                    ...data,
                }
            })
        )

        const results: any = {
            services: {},
            summary: {
                total: services.length,
                healthy: 0,
                degraded: 0,
                unhealthy: 0,
            },
        }

        // Process results
        healthChecks.forEach((result, index) => {
            const serviceName = services[index]

            if (result.status === 'fulfilled') {
                const serviceData = result.value
                results.services[serviceName] = {
                    status: serviceData.status,
                    responseTime: serviceData.responseTime,
                    timestamp: serviceData.timestamp,
                    details: serviceData.details || {},
                }

                // Update summary counts
                switch (serviceData.status) {
                    case 'healthy':
                        results.summary.healthy++
                        break
                    case 'degraded':
                        results.summary.degraded++
                        break
                    case 'unhealthy':
                    default:
                        results.summary.unhealthy++
                        break
                }
            } else {
                results.services[serviceName] = {
                    status: 'unhealthy',
                    error: result.reason?.message || 'Health check failed',
                    timestamp: new Date().toISOString(),
                }
                results.summary.unhealthy++
            }
        })

        // Determine overall system health
        let overallStatus = 'healthy'
        if (results.summary.unhealthy > 0) {
            // If any critical services are down, mark as unhealthy
            const criticalServices = ['backend', 'rpc']
            const criticalServicesDown = criticalServices.some(
                (service) => results.services[service]?.status === 'unhealthy'
            )

            if (criticalServicesDown || results.summary.unhealthy >= 3) {
                overallStatus = 'unhealthy'
            } else {
                overallStatus = 'degraded'
            }
        } else if (results.summary.degraded > 0) {
            overallStatus = 'degraded'
        }

        const totalResponseTime = Date.now() - startTime

        // Calculate health score (0-100)
        const healthScore = Math.round(
            ((results.summary.healthy + results.summary.degraded * 0.5) / results.summary.total) * 100
        )

        return NextResponse.json({
            status: overallStatus,
            service: 'peanut-ui-overall',
            timestamp: new Date().toISOString(),
            responseTime: totalResponseTime,
            healthScore,
            summary: results.summary,
            services: results.services,
            systemInfo: {
                environment: process.env.NODE_ENV,
                version: process.env.npm_package_version || 'unknown',
                region: process.env.VERCEL_REGION || 'unknown',
            },
        })
    } catch (error) {
        const totalResponseTime = Date.now() - startTime

        return NextResponse.json(
            {
                status: 'unhealthy',
                service: 'peanut-ui-overall',
                timestamp: new Date().toISOString(),
                error: error instanceof Error ? error.message : 'Unknown error',
                responseTime: totalResponseTime,
                healthScore: 0,
            },
            { status: 500 }
        )
    }
}
