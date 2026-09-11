'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Loading from '@/components/Global/Loading'

/**
 * Retired paid-admission links. A link with a chargeId forwards to the
 * semantic request surface, which renders a COMPLETED charge as a receipt
 * and redirects unpaid admission charges to /card. Links without a charge
 * open the public card application.
 */
export default function CardPaymentPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    useEffect(() => {
        const chargeId = searchParams.get('chargeId')
        // cross-route redirect, not URL state on this page — nuqs does not
        // apply; the params belong to the destination route
        const destination = new URLSearchParams({ chargeId: chargeId ?? '', context: 'card-pioneer' })
        router.replace(chargeId ? '/pay-request?' + destination.toString() : '/card')
    }, [router, searchParams])
    return <Loading />
}
