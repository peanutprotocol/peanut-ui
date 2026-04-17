'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getAuthToken } from '@/utils/auth-token'

export default function RootRedirect() {
    const router = useRouter()
    useEffect(() => {
        const token = getAuthToken()
        router.replace(token ? '/home' : '/setup')
    }, [router])
    return null
}
