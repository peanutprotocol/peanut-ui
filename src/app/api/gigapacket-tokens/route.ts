import { ethers } from 'ethers'
import { NextResponse } from 'next/server'

const GIGAPACKET_TOKENS_DOC = process.env.GIGAPACKET_TOKENS_DOC!

export async function GET() {
    const docResponse = await fetch(GIGAPACKET_TOKENS_DOC)
    const docContents = await docResponse.text()
    const allLines = docContents.split('\n')

    const tokens = []
    for (let line of allLines) {
        try {
            line = line.trim()
            let [symbol, address] = line.split(' - ')
            symbol = symbol.toUpperCase()
            address = ethers.utils.getAddress(address)
            tokens.push({ symbol, address })
        } catch (error: any) {
            console.log(`Got error while processing docs Mantle tokens doc line ${line}: ${error}. Skipping this line.`)
            continue
        }
    }

    console.log('Got tokens from the google doc!', tokens)
    return NextResponse.json(tokens)
}
