import { NextResponse } from 'next/server'
import { PEANUT_API_URL } from '@/constants'
import { fetchWithSentry } from '@/utils'

/**
 * Health check for Peanut API backend
 * Tests connectivity to the main peanut-api-ts backend service
 */
export async function GET() {
    const startTime = Date.now()

    try {
        if (!PEANUT_API_URL) {
            return NextResponse.json(
                {
                    status: 'unhealthy',
                    service: 'backend',
                    timestamp: new Date().toISOString(),
                    error: 'PEANUT_API_URL not configured',
                    responseTime: Date.now() - startTime,
                },
                { status: 500 }
            )
        }

        // Test backend connectivity by fetching a specific user endpoint
        const backendTestStart = Date.now()
        const backendResponse = await fetchWithSentry(`${PEANUT_API_URL}/users/username/hugo`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        })

        const backendResponseTime = Date.now() - backendTestStart

        // Backend is healthy if we get any response (200, 404, etc.) - what matters is connectivity
        if (!backendResponse.ok && backendResponse.status >= 500) {
            throw new Error(`Backend API returned server error ${backendResponse.status}`)
        }

        const totalResponseTime = Date.now() - startTime

        return NextResponse.json({
            status: 'healthy',
            service: 'backend',
            timestamp: new Date().toISOString(),
            responseTime: totalResponseTime,
            details: {
                apiConnectivity: {
                    status: 'healthy',
                    responseTime: backendResponseTime,
                    httpStatus: backendResponse.status,
                    apiUrl: PEANUT_API_URL,
                    testEndpoint: '/users/username/hugo',
                    message: backendResponse.ok
                        ? 'Backend responding normally'
                        : backendResponse.status === 404
                          ? 'Backend accessible (user not found as expected)'
                          : 'Backend accessible',
                },
            },
        })
    } catch (error) {
        const totalResponseTime = Date.now() - startTime

        return NextResponse.json(
            {
                status: 'unhealthy',
                service: 'backend',
                timestamp: new Date().toISOString(),
                error: error instanceof Error ? error.message : 'Unknown error',
                responseTime: totalResponseTime,
            },
            { status: 500 }
        )
    }
}
