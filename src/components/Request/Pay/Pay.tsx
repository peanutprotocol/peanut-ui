'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { fetchWithSentry } from '@/utils'

import { jsonParse, getRequestLink } from '@/utils'
import { useRouter } from 'next/navigation'
import { ChargeEntry } from '@/services/services.types'
import { PEANUT_API_URL } from '@/constants'

export const PayRequestLink = () => {
    const searchParams = useSearchParams()
    const router = useRouter()

    const checkRequestLink = async (uuid: string) => {
        const chargeResponse = await fetchWithSentry(`${PEANUT_API_URL}/request-charges/${uuid}`)
        if (!chargeResponse.ok) {
            router.push('/404')
            return
        }
        const charge = jsonParse(await chargeResponse.text()) as ChargeEntry
        const link = getRequestLink({
            ...charge.requestLink,
            chainId: charge.chainId,
            tokenAmount: charge.tokenAmount,
            tokenSymbol: charge.tokenSymbol,
            chargeId: charge.uuid,
        })
        router.push(link)
        return
    }

    useEffect(() => {
        const id = searchParams.get('id')
        if (id) {
            checkRequestLink(id)
        } else {
            router.push('/404')
        }
    }, [searchParams])

    return null
}
