'use client'

import { useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'

// copies created by native build script from [code]/ pages
const QrClaimPage = dynamic(() => import('./_claim-page'), { ssr: false })
const QrSuccessPage = dynamic(() => import('./_success-page'), { ssr: false })

export default function QrPage() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const code = searchParams.get('code')
    const view = searchParams.get('view')

    useEffect(() => {
        if (!code) router.replace('/home')
    }, [code, router])

    if (!code) return null

    if (view === 'success') {
        return <QrSuccessPage />
    }

    return <QrClaimPage />
}
