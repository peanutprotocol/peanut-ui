'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

import { getRequestLink } from '@/utils/general.utils'
import { useRouter } from 'next/navigation'
import { chargesApi } from '@/services/charges'
import { isCapacitor } from '@/utils/capacitor'
import { chargePayUrl } from '@/utils/native-routes'

export const PayRequestLink = () => {
    const searchParams = useSearchParams()
    const router = useRouter()

    const checkRequestLink = async (uuid: string) => {
        try {
            const charge = await chargesApi.get(uuid)
            if (isCapacitor()) {
                // uuid is a CHARGE id (chargesApi just resolved it) — the
                // request-pot dispatch treated it as a pot id and 404'd.
                router.push(chargePayUrl(uuid))
            } else {
                const link = getRequestLink({
                    ...charge.requestLink,
                    chainId: charge.chainId,
                    tokenAmount: charge.tokenAmount,
                    tokenSymbol: charge.tokenSymbol,
                })
                router.push(link)
            }
            return
        } catch {
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
