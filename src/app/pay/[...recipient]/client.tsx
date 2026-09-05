'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { parseAsString, useQueryStates } from 'nuqs'
import PaymentPage from '@/app/[...recipient]/client'
import { sendUrl } from '@/utils/native-routes'

/**
 * `/pay/<recipient>` serves two link shapes that used to be told apart by their
 * path alone:
 *
 * - a bare recipient is the "My QR" payload — a request to pay someone, which
 *   hands off to the send flow exactly as it did before this route existed;
 * - anything carrying an amount segment or a charge/request id is a shared
 *   payment link, and renders the same page the root `/<recipient>` catch-all
 *   does.
 */
export default function PayRoute({ recipient }: { recipient: string[] }) {
    const router = useRouter()
    const [{ id, chargeId }] = useQueryStates({ id: parseAsString, chargeId: parseAsString })
    const isPaymentLink = recipient.length > 1 || !!id || !!chargeId

    useEffect(() => {
        if (isPaymentLink) return
        router.replace(recipient[0] ? sendUrl(decodeURIComponent(recipient[0])) : '/send')
    }, [isPaymentLink, recipient, router])

    if (!isPaymentLink) return null
    return <PaymentPage recipient={recipient} />
}
