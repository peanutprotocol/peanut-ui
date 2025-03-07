'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

import { getRequestLink } from '@/utils'
import { useRouter } from 'next/navigation'
import { chargesApi } from '@/services/charges'

export const PayRequestLink = () => {
    const searchParams = useSearchParams()
    const router = useRouter()

    const checkRequestLink = async (uuid: string) => {
        try {
            const charge = await chargesApi.get(uuid)
            const link = getRequestLink({
                ...charge.requestLink,
                chainId: charge.chainId,
                tokenAmount: charge.tokenAmount,
                tokenSymbol: charge.tokenSymbol,
                chargeId: charge.uuid,
            })
            router.push(link)
            return
        } catch (e) {
            router.push('/404')
            return
        }
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
