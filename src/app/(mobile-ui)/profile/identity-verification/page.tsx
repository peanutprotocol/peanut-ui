'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Loading from '@/components/Global/Loading'

/**
 * Routing alias for /profile/accounts-and-payments. The backend's KYC push and
 * email deep links, including ones already delivered, still carry this path
 * with `?step=…&provider=…`. The redirect runs on the client because the
 * native static export cannot render a server redirect that reads searchParams.
 * Remove once the backend templates point at the new path and sent links have aged out.
 */
export default function IdentityVerificationAlias() {
    const router = useRouter()
    useEffect(() => {
        // The whole query is forwarded untouched, so there is no param for nuqs to type.
        router.replace(`/profile/accounts-and-payments${window.location.search}`)
    }, [router])
    return <Loading />
}
