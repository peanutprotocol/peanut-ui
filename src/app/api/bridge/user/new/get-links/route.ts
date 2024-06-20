import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'

async function getUserByEmail(email: string, apiKey: string): Promise<any | null> {
    try {
        const response = await fetch('https://api.bridge.xyz/v0/kyc_links', {
            method: 'GET',
            headers: {
                'Api-Key': apiKey,
                Accept: 'application/json',
            },
        })

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()

        // Find user by email
        const user = data.data.find((user: any) => user.email === email)
        console.log('User:', user)
        return user || null
    } catch (error) {
        console.error('Failed to fetch user:', error)
        throw new Error('Failed to fetch user')
    }
}

export async function POST(request: NextRequest) {
    try {
        const { type, full_name, email } = await request.json()

        if (!process.env.BRIDGE_API_KEY) {
            throw new Error('BRIDGE_API_KEY is not defined')
        }

        // Check if user already exists
        const existingUser = await getUserByEmail(email, process.env.BRIDGE_API_KEY)

        if (existingUser) {
            // User already exists, return the existing user object
            return new NextResponse(JSON.stringify(existingUser), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                },
            })
        }

        // Generate a unique idempotency key
        const idempotencyKey = uuidv4()

        // Make a POST request to create a new user
        const response = await fetch('https://api.bridge.xyz/v0/kyc_links', {
            method: 'POST',
            headers: {
                'Api-Key': process.env.BRIDGE_API_KEY,
                'Idempotency-Key': idempotencyKey,
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                type,
                full_name,
                email,
            }),
        })

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()

        // Return response to client
        return new NextResponse(JSON.stringify(data), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        })
    } catch (error) {
        console.error('Failed to create or retrieve KYC link:', error)
        return new NextResponse('Internal Server Error', { status: 500 })
    }
}
