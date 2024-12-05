import { ChainId } from '@justaname.id/sdk'
import { NextRequest } from 'next/server'
import {getJustaNameInstance} from "@/config/justaname.config";

export async function POST(req: NextRequest) {
    const requestBody = await req.json()
    const { username, message, signature, address } = requestBody

    if (!username) {
        return new Response('Username is required', { status: 400 })
    }

    if (!address) {
        return new Response('Address is required', { status: 400 })
    }

    if (!signature) {
        return new Response('Signature is required', { status: 400 })
    }

    if (!message) {
        return new Response('Message is required', { status: 400 })
    }

    const chainId = parseInt(
        message.split('Chain ID: ')[1].split('\n')[0],
    ) as ChainId

    const justaname = getJustaNameInstance()

    const subnames = await justaname.subnames.getSubnamesByAddress({
        address: address,
        chainId: chainId,
        coinType: 60,
        isClaimed: true,
    })

    const subnameExists = subnames.subnames.some((sub) => {
        const domain = sub.ens.split('.').slice(1).join('.')
        return domain === process.env.JUSTANAME_ENS_DOMAIN
    })
    if (subnameExists) {
        return Response.json({
            result: {
                error: `Already claimed ${process.env.JUSTANAME_ENS_DOMAIN} subname`,
            },
        })
    }

    const ensDomain = process.env.JUSTANAME_ENS_DOMAIN as string
    try {
        const subname = await justaname.subnames.addSubname(
            {
                username: username,
                ensDomain,
                chainId,
            },
            {
                xSignature: signature,
                xAddress: address,
                xMessage: message,
            },
        )
        return Response.json(subname)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
        return new Response(e.message, { status: 500 })
    }
}
