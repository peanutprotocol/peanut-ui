'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PointsInvitesRedirect() {
    const router = useRouter()
    useEffect(() => { router.replace('/rewards/invites') }, [router])
    return null
}
