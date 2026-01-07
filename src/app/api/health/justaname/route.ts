import { fetchWithSentry } from '@/utils/sentry.utils'
import { NextResponse } from 'next/server'

const JUSTANAME_API_URL = 'https://api.justaname.id'

/**
 * Health check for JustAName API
 * Tests ENS name resolution functionality
 */
export async function GET() {
    const startTime = Date.now()

    try {
        // Test ENS resolution endpoint with a known Ethereum address (Vitalik's)
        const ensTestStart = Date.now()
        const testAddress = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' // Vitalik's address

        const ensResponse = await fetchWithSentry(
            `${JUSTANAME_API_URL}/ens/v1/subname/address?address=${testAddress}&chainId=1`,
            {
                headers: {
                    Accept: '*/*',
                    'Content-Type': 'application/json',
                },
            }
        )

        const ensResponseTime = Date.now() - ensTestStart

        if (!ensResponse.ok) {
            throw new Error(`ENS resolution API returned ${ensResponse.status}`)
        }

        const ensData = await ensResponse.json()

        // Validate response structure
        if (!ensData?.result) {
            throw new Error('Invalid ENS API response structure')
        }

        // Test a second endpoint - ENS name lookup (if available)
        const lookupTestStart = Date.now()
        let lookupHealth: any = { status: 'not_tested', message: 'Lookup endpoint not tested' }

        try {
            // Test reverse ENS lookup if the API supports it
            const lookupResponse = await fetchWithSentry(`${JUSTANAME_API_URL}/ens/v1/name/vitalik.eth`, {
                headers: {
                    Accept: '*/*',
                    'Content-Type': 'application/json',
                },
            })

            const lookupResponseTime = Date.now() - lookupTestStart

            lookupHealth = {
                status: lookupResponse.ok ? 'healthy' : 'degraded',
                responseTime: lookupResponseTime,
                httpStatus: lookupResponse.status,
            }
        } catch (error) {
            // If lookup fails, that's okay - not all endpoints may be available
            lookupHealth = {
                status: 'degraded',
                responseTime: Date.now() - lookupTestStart,
                error: 'Lookup endpoint unavailable',
            }
        }

        const totalResponseTime = Date.now() - startTime

        return NextResponse.json({
            status: 'healthy',
            service: 'justaname',
            timestamp: new Date().toISOString(),
            responseTime: totalResponseTime,
            details: {
                ensResolution: {
                    status: 'healthy',
                    responseTime: ensResponseTime,
                    testAddress,
                    apiUrl: JUSTANAME_API_URL,
                },
                ensLookup: lookupHealth,
            },
        })
    } catch (error) {
        const totalResponseTime = Date.now() - startTime

        return NextResponse.json(
            {
                status: 'unhealthy',
                service: 'justaname',
                timestamp: new Date().toISOString(),
                error: error instanceof Error ? error.message : 'Unknown error',
                responseTime: totalResponseTime,
            },
            { status: 500 }
        )
    }
}
