import { NextResponse } from 'next/server'
import { fetchWithSentry } from '@/utils'
import { SELF_URL } from '@/constants'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

/**
 * Overall health check endpoint
 * Aggregates health status from all individual service health checks
 * This is the main endpoint that should be monitored by UptimeRobot
 */

/**
 * Send Discord notification when system is unhealthy
 */
async function sendDiscordNotification(healthData: any) {
    try {
        const webhookUrl = process.env.DISCORD_WEBHOOK_URL
        if (!webhookUrl) {
            console.log('Discord webhook not configured, skipping notification')
            return
        }

        // Create a detailed message about what's failing
        const failedServices = Object.entries(healthData.services)
            .filter(([_, service]: [string, any]) => service.status === 'unhealthy')
            .map(([name, service]: [string, any]) => `• ${name}: ${service.error || 'unhealthy'}`)

        // Only mention role in production or peanut.me
        const isProduction = process.env.NODE_ENV === 'production'
        const isPeanutDomain =
            (process.env.NEXT_PUBLIC_BASE_URL?.includes('peanut.me') &&
                !process.env.NEXT_PUBLIC_BASE_URL?.includes('staging.peanut.me')) ||
            (process.env.VERCEL_URL?.includes('peanut.me') && !process.env.VERCEL_URL?.includes('staging.peanut.me'))
        const shouldMentionRole = isProduction || isPeanutDomain

        const roleMention = shouldMentionRole ? '<@&1187109195389083739> ' : ''

        const message = `${roleMention}🚨 **Peanut Health Alert** 🚨

System Status: **${healthData.status.toUpperCase()}**
Health Score: ${healthData.healthScore}%
Environment: ${healthData.systemInfo?.environment || 'unknown'}

**Failed Services:**
${failedServices.length > 0 ? failedServices.join('\n') : 'No specific failures detected'}

**Summary:**
• Healthy: ${healthData.summary.healthy}
• Degraded: ${healthData.summary.degraded}
• Unhealthy: ${healthData.summary.unhealthy}

Timestamp: ${healthData.timestamp}`

        await fetchWithSentry(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                content: message,
            }),
        })

        console.log('Discord notification sent for unhealthy system status')
    } catch (error) {
        console.error('Failed to send Discord notification:', error)
        // Don't throw - we don't want notification failures to break the health check
    }
}

export async function GET() {
    const startTime = Date.now()

    try {
        const services = ['mobula', 'squid', 'zerodev', 'rpc', 'justaname', 'backend', 'manteca']
        const HEALTH_CHECK_TIMEOUT = 8000 // 8 seconds per service

        const healthChecks = await Promise.allSettled(
            services.map(async (service) => {
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(
                        () => reject(new Error(`${service} health check timeout after ${HEALTH_CHECK_TIMEOUT}ms`)),
                        HEALTH_CHECK_TIMEOUT
                    )
                })

                // Race the fetch against the timeout
                const healthCheckPromise = (async () => {
                    const response = await fetchWithSentry(`${SELF_URL}/api/health/${service}`, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        cache: 'no-store',
                        next: { revalidate: 0 },
                    })

                    if (!response.ok) {
                        throw new Error(`Health check failed with status ${response.status}`)
                    }

                    const data = await response.json()
                    return {
                        service,
                        ...data,
                    }
                })()

                return Promise.race([healthCheckPromise, timeoutPromise])
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

        // If overall status is unhealthy, return HTTP 500
        if (overallStatus === 'unhealthy') {
            const responseData = {
                status: overallStatus,
                service: 'peanut-protocol',
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
            }

            // Send Discord notification asynchronously (don't await to avoid delaying the response)
            sendDiscordNotification(responseData).catch(console.error)

            return NextResponse.json(responseData, {
                status: 500,
                headers: {
                    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                    Pragma: 'no-cache',
                    Expires: '0',
                    'Surrogate-Control': 'no-store',
                },
            })
        }

        return NextResponse.json(
            {
                status: overallStatus,
                service: 'peanut-protocol',
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
                service: 'peanut-protocol',
                timestamp: new Date().toISOString(),
                error: error instanceof Error ? error.message : 'Unknown error',
                responseTime: totalResponseTime,
                healthScore: 0,
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
