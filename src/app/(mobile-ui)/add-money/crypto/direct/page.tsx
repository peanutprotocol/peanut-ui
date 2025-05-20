'use client'

import PaymentPage from '@/app/[...recipient]/client'
import PageContainer from '@/components/0_Bruddle/PageContainer'
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
        return (
            <PageContainer className="flex min-h-[inherit] items-center justify-center">
                <PeanutLoading />
            </PageContainer>
        )
    }

    // The recipient for PaymentPage is an array of strings that form the path segments.
    // For a direct address, it would typically be just the address itself.
    const recipientPathSegments = [recipientUsername ?? '']

    return (
        <PageContainer className="min-h-[inherit]">
            {/* NavHeader might be part of PaymentForm/InitialPaymentView, or handled within PaymentPage context */}
            {/* For AddMoney, the PaymentForm should ideally show "Add Money" as title */}
            <PaymentPage recipient={recipientPathSegments} flow="add_money" />
        </PageContainer>
    )
}
