'use client'

import { useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'

// stubs exist for web build; real components are injected by native build script.
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
