import { NextRequest, NextResponse } from 'next/server'
// @ts-ignore: CommonJS module without types
const { ibanToBic } = require('iban-to-bic')

export async function POST(request: NextRequest) {
    try {
        const { iban } = await request.json()
        if (!iban) {
            return NextResponse.json({ error: 'Missing IBAN in request body' }, { status: 400 })
        }

        let bic: string
        try {
            bic = ibanToBic(iban)
        } catch (err: any) {
            console.error('Failed to convert IBAN to BIC:', err)
            return NextResponse.json({ error: 'Unable to derive BIC from IBAN' }, { status: 400 })
        }

        return NextResponse.json({ bic }, { status: 200 })
    } catch (error) {
        console.error('IBAN-to-BIC route error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
