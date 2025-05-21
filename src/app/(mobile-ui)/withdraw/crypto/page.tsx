'use client'

import PageContainer from '@/components/0_Bruddle/PageContainer'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function WithdrawPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [recipientUsername, setRecipientUsername] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        // const username = searchParams.get('to')
        // if (username) {
        //     setRecipientUsername(username)
        // } else {
        //     router.push('/add-money/crypto')
        // }
        // setIsLoading(false)
    }, [searchParams, router])

    const recipientPathSegments = [recipientUsername ?? '']

    return (
        <PageContainer className="min-h-[inherit]">
            {/* <PaymentPage recipient={recipientPathSegments} flow="withdraw" /> */}
            gm
        </PageContainer>
    )
}
