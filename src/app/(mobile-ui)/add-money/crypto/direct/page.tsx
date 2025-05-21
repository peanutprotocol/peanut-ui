'use client'

import PaymentPage from '@/app/[...recipient]/client'
import PeanutLoading from '@/components/Global/PeanutLoading'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function AddMoneyCryptoDirectPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [recipientUsername, setRecipientUsername] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const username = searchParams.get('to')
        if (username) {
            setRecipientUsername(username)
        } else {
            router.push('/add-money/crypto')
        }
        setIsLoading(false)
    }, [searchParams, router])

    if (isLoading) {
        return <PeanutLoading />
    }

    const recipientPathSegments = [recipientUsername ?? '']

    return <PaymentPage recipient={recipientPathSegments} flow="add_money" />
}
