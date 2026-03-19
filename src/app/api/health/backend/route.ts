import { NextResponse } from 'next/server'
import { PEANUT_API_URL } from '@/constants/general.consts'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

const NO_CACHE_HEADERS = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
    'Surrogate-Control': 'no-store',
}

/**
 * Health check for Peanut API backend.
 * Uses the backend's dedicated /healthz endpoint (checks DB connectivity).
 * Uses plain fetch to avoid health check errors polluting Sentry.
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
                { status: 500, headers: NO_CACHE_HEADERS }
            )
        }

        const backendTestStart = Date.now()
        const backendResponse = await fetch(`${PEANUT_API_URL}/healthz`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            cache: 'no-store',
            signal: AbortSignal.timeout(8000),
        })

        const backendResponseTime = Date.now() - backendTestStart

        if (!backendResponse.ok) {
            const errorData = await backendResponse.json().catch(() => null)
            throw new Error(
                errorData?.error || `Backend /healthz returned ${backendResponse.status}`
            )
        }

        const healthData = await backendResponse.json()
        const totalResponseTime = Date.now() - startTime

        return NextResponse.json(
            {
                status: 'healthy',
                service: 'backend',
                timestamp: new Date().toISOString(),
                responseTime: totalResponseTime,
                details: {
                    healthz: {
                        status: 'healthy',
                        responseTime: backendResponseTime,
                        httpStatus: backendResponse.status,
                        apiUrl: PEANUT_API_URL,
                        dbConnected: healthData.dbConnected ?? true,
                    },
                },
            },
            { status: 200, headers: NO_CACHE_HEADERS }
        )
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
            { status: 500, headers: NO_CACHE_HEADERS }
        )
    }
}
