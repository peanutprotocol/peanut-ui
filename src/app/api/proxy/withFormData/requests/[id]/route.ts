import { PEANUT_API_URL } from '@/constants'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const formData = await request.formData()
        const apiUrl = `${PEANUT_API_URL}/requests/${params.id}`

        const response = await fetch(apiUrl, {
            method: 'PATCH',
            headers: {
                'api-key': process.env.PEANUT_API_KEY!,
            },
            body: formData,
        })

        const data = await response.json()

        if (!response.ok) {
            return NextResponse.json(data, { status: response.status })
        }

        return NextResponse.json(data)
    } catch (error) {
        console.error('Error updating request:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}