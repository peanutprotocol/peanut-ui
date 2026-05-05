import { NextResponse } from 'next/server'
import { SELF_URL } from '@/constants/general.consts'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

/**
 * Overall health check endpoint.
 * Aggregates health status from all individual service health checks.
 * Monitored by UptimeRobot → status.peanut.me
 *
 * Discord webhook has a 30-minute cooldown to avoid spam when UptimeRobot
 * polls every few minutes during an ongoing incident.
 *
 * Uses plain fetch for sub-checks to avoid health check errors polluting Sentry.
 */

// In-memory cooldown for Discord notifications.
// Vercel serverless functions are ephemeral, so this resets on cold starts —
// that's acceptable since cold starts are infrequent enough to not cause spam.
let lastNotificationTime = 0
const NOTIFICATION_COOLDOWN_MS = 30 * 60 * 1000 // 30 minutes

/**
 * Send Discord notification when system is unhealthy (with cooldown).
 */
async function sendDiscordNotification(healthData: any) {
    try {
        const webhookUrl = process.env.DISCORD_WEBHOOK_URL
        if (!webhookUrl) {
            console.log('Discord webhook not configured, skipping notification')
            return
        }

        // Cooldown check — don't spam Discord
        const now = Date.now()
        if (now - lastNotificationTime < NOTIFICATION_COOLDOWN_MS) {
            console.log(
                `Discord notification skipped (cooldown). Last sent ${Math.round((now - lastNotificationTime) / 1000)}s ago.`
            )
            return
        }
        lastNotificationTime = now

        const failedServices = Object.entries(healthData.services)
            .filter(([_, service]: [string, any]) => service.status === 'unhealthy')
            .map(([name, service]: [string, any]) => `• ${name}: ${service.error || 'unhealthy'}`)

        const degradedServices = Object.entries(healthData.services)
            .filter(([_, service]: [string, any]) => service.status === 'degraded')
            .map(([name, service]: [string, any]) => `• ${name}: ${service.error || 'degraded'}`)

        // Only @mention the role in production
        const isProduction = process.env.NODE_ENV === 'production'
        const isPeanutDomain =
            (process.env.NEXT_PUBLIC_BASE_URL?.includes('peanut.me') &&
                !process.env.NEXT_PUBLIC_BASE_URL?.includes('staging.peanut.me')) ||
            (process.env.VERCEL_URL?.includes('peanut.me') && !process.env.VERCEL_URL?.includes('staging.peanut.me'))
        const shouldMentionRole = isProduction || isPeanutDomain

        const roleMention = shouldMentionRole ? '<@&1187109195389083739> ' : ''

        let message = `${roleMention}🚨 **Peanut Health Alert** 🚨

System Status: **${healthData.status.toUpperCase()}**
Health Score: ${healthData.healthScore}%
Environment: ${healthData.systemInfo?.environment || 'unknown'}

**Failed Services:**
${failedServices.length > 0 ? failedServices.join('\n') : 'No specific failures detected'}`

        if (degradedServices.length > 0) {
            message += `\n\n**Degraded Services:**\n${degradedServices.join('\n')}`
        }

        message += `\n\n**Summary:**
• Healthy: ${healthData.summary.healthy}
• Degraded: ${healthData.summary.degraded}
• Unhealthy: ${healthData.summary.unhealthy}

Timestamp: ${healthData.timestamp}`

        await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: message }),
        })

        console.log('Discord notification sent for unhealthy system status')
    } catch (error) {
        console.error('Failed to send Discord notification:', error)
    }
}

const NO_CACHE_HEADERS = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
    'Surrogate-Control': 'no-store',
}

export async function GET() {
    const startTime = Date.now()

    try {
        const services = ['mobula', 'zerodev', 'rpc', 'justaname', 'backend', 'manteca']
        const HEALTH_CHECK_TIMEOUT = 8000

        const healthChecks = await Promise.allSettled(
            services.map(async (service) => {
                const controller = new AbortController()
                const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT)

                try {
                    // Use plain fetch — health check errors are expected, not Sentry-worthy
                    const response = await fetch(`${SELF_URL}/api/health/${service}`, {
                        method: 'GET',
                        headers: { 'Content-Type': 'application/json' },
                        cache: 'no-store',
                        signal: controller.signal,
                    })

                    clearTimeout(timeoutId)

                    const data = await response.json()

                    // Pass through the sub-check's own status rather than only trusting HTTP status.
                    // Sub-checks now return degraded (HTTP 200) for non-critical partial failures.
                    return { service, ...data }
                } catch (error) {
                    clearTimeout(timeoutId)
                    throw error
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
                const serviceData = result.value as any
                const serviceStatus = serviceData.status || 'unhealthy'

                results.services[serviceName] = {
                    status: serviceStatus,
                    responseTime: serviceData.responseTime,
                    timestamp: serviceData.timestamp,
                    details: serviceData.details || {},
                    ...(serviceData.error ? { error: serviceData.error } : {}),
                }

                switch (serviceStatus) {
                    case 'healthy':
                        results.summary.healthy++
                        break
                    case 'degraded':
                        results.summary.degraded++
                        break
                    default:
                        results.summary.unhealthy++
                        break
                }
            } else {
                const errorMessage =
                    result.reason?.name === 'AbortError'
                        ? `${serviceName} health check timeout after ${HEALTH_CHECK_TIMEOUT}ms`
                        : result.reason?.message || 'Health check failed'

                results.services[serviceName] = {
                    status: 'unhealthy',
                    error: errorMessage,
                    timestamp: new Date().toISOString(),
                }
                results.summary.unhealthy++
            }
        })

        // Determine overall system health
        let overallStatus = 'healthy'
        if (results.summary.unhealthy > 0) {
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

        const healthScore = Math.round(
            ((results.summary.healthy + results.summary.degraded * 0.5) / results.summary.total) * 100
        )

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

        if (overallStatus === 'unhealthy') {
            sendDiscordNotification(responseData).catch(console.error)
            return NextResponse.json(responseData, { status: 500, headers: NO_CACHE_HEADERS })
        }

        return NextResponse.json(responseData, { status: 200, headers: NO_CACHE_HEADERS })
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
            { status: 500, headers: NO_CACHE_HEADERS }
        )
    }
}
