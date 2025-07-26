import { NextResponse } from 'next/server'

/**
 * Basic frontend health check endpoint
 * Tests that the Next.js API routes are working
 */
export async function GET() {
    try {
        const healthData = {
            status: 'healthy',
            service: 'peanut-ui',
            timestamp: new Date().toISOString(),
            version: process.env.npm_package_version || 'unknown',
            environment: process.env.NODE_ENV,
            uptime: process.uptime(),
        }

        return NextResponse.json(healthData, { status: 200 })
    } catch (error) {
        return NextResponse.json(
            {
                status: 'unhealthy',
                service: 'peanut-ui',
                timestamp: new Date().toISOString(),
                error: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        )
    }
}
