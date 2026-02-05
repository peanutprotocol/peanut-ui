'use client'

import { useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { chargesApi } from '@/services/charges'
import Loading from '@/components/Global/Loading'

/**
 * Card Payment Route (DEPRECATED)
 *
 * This page is kept for backwards compatibility with existing URLs/bookmarks.
 * The card flow now navigates directly to the semantic URL from /card page,
 * avoiding this intermediate loading state.
 *
 * Fetches charge and redirects to semantic URL with context=card-pioneer
 */
export default function CardPaymentPage() {
    const searchParams = useSearchParams()
    const router = useRouter()

    useEffect(() => {
        const chargeId = searchParams.get('chargeId')
        if (!chargeId) {
            router.push('/card')
            return
        }

        const redirectToPayment = async () => {
            try {
                const charge = await chargesApi.get(chargeId)

                // Build semantic URL from charge data
                // Format: /recipient@chainId/amountTOKEN?chargeId=uuid&context=card-pioneer
                // NOTE: Use chargeId parameter (not id) to match semantic request flow
                const recipient = charge.requestLink.recipientAddress
                const chain = charge.chainId ? `@${charge.chainId}` : ''
                const amount = charge.tokenAmount
                const token = charge.tokenSymbol
                const uuid = charge.uuid

                const semanticUrl = `/${recipient}${chain}/${amount}${token}?chargeId=${uuid}&context=card-pioneer`

                router.push(semanticUrl)
            } catch (err) {
                console.error('Failed to load charge:', err)
                router.push('/card')
            }
        }

        redirectToPayment()
    }, [searchParams, router])

    return (
        <div className="flex min-h-screen items-center justify-center">
            <Loading />
        </div>
    )
}
