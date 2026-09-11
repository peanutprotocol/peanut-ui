'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Loading from '@/components/Global/Loading'

/** Retired paid-admission links now open the public card application. */
export default function CardPaymentPage() {
    const router = useRouter()
    useEffect(() => {
        router.replace('/card')
    }, [router])
    return <Loading />
}
