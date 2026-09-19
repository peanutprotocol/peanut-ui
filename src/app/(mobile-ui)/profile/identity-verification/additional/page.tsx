'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Loading from '@/components/Global/Loading'

/** Routing alias for /profile/accounts-and-payments/additional. See ../page.tsx. */
export default function AdditionalVerificationAlias() {
    const router = useRouter()
    useEffect(() => {
        router.replace(`/profile/accounts-and-payments/additional${window.location.search}`)
    }, [router])
    return <Loading />
}
