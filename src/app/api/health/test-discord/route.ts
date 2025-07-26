import { NextResponse } from 'next/server'
import { fetchWithSentry } from '@/utils'

/**
 * Test endpoint for Discord notifications
 * Simulates an unhealthy system status and sends a Discord notification
 */
export async function POST() {
    try {
        const webhookUrl = process.env.DISCORD_WEBHOOK_URL

        if (!webhookUrl) {
            return NextResponse.json(
                { error: 'Discord webhook not configured in environment variables' },
                { status: 400 }
            )
        }

        // Create test unhealthy data
        const testHealthData = {
            status: 'unhealthy',
            service: 'peanut-protocol',
            timestamp: new Date().toISOString(),
            healthScore: 33,
            summary: {
                total: 6,
                healthy: 2,
                degraded: 1,
                unhealthy: 3,
            },
            services: {
                mobula: { status: 'unhealthy', error: 'API timeout after 5000ms' },
                squid: { status: 'healthy' },
                zerodev: { status: 'degraded' },
                rpc: { status: 'unhealthy', error: 'Infura rate limit exceeded' },
                justaname: { status: 'healthy' },
                backend: { status: 'unhealthy', error: 'Database connection failed' },
            },
            systemInfo: {
                environment: process.env.NODE_ENV || 'test',
                version: process.env.npm_package_version || 'test',
                region: process.env.VERCEL_REGION || 'test',
            },
        }

        // Create detailed Discord message
        const failedServices = Object.entries(testHealthData.services)
            .filter(([_, service]: [string, any]) => service.status === 'unhealthy')
            .map(([name, service]: [string, any]) => `• ${name}: ${service.error || 'unhealthy'}`)

        const message = `🧪 **TEST: Peanut Protocol Health Alert** 🧪

System Status: **${testHealthData.status.toUpperCase()}**
Health Score: ${testHealthData.healthScore}%
Environment: ${testHealthData.systemInfo?.environment || 'unknown'}

**Failed Services:**
${failedServices.length > 0 ? failedServices.join('\n') : 'No specific failures detected'}

**Summary:**
• Healthy: ${testHealthData.summary.healthy}
• Degraded: ${testHealthData.summary.degraded}
• Unhealthy: ${testHealthData.summary.unhealthy}

Timestamp: ${testHealthData.timestamp}

*This is a test notification - not a real alert!*`

        // Send Discord notification
        const response = await fetchWithSentry(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                content: message,
            }),
        })

        if (!response.ok) {
            throw new Error(`Discord API returned ${response.status}: ${response.statusText}`)
        }

        return NextResponse.json({
            success: true,
            message: 'Test Discord notification sent successfully',
            webhookResponse: {
                status: response.status,
                statusText: response.statusText,
            },
        })
    } catch (error) {
        console.error('Failed to send test Discord notification:', error)

        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        )
    }
}
