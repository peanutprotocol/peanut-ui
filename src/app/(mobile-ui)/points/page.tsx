'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PointsRedirect() {
    const router = useRouter()
    useEffect(() => { router.replace('/rewards') }, [router])
    return null
}
