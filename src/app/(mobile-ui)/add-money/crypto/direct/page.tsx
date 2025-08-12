'use client'

import PaymentPage from '@/app/[...recipient]/client'
import PeanutLoading from '@/components/Global/PeanutLoading'
import { useAppDispatch, useUserStore } from '@/redux/hooks'
import { paymentActions } from '@/redux/slices/payment-slice'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function AddMoneyCryptoDirectPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { user } = useUserStore()
    const [recipientUsername, setRecipientUsername] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const dispatch = useAppDispatch()

    useEffect(() => {
        dispatch(paymentActions.resetPaymentState())
    }, [dispatch])

    useEffect(() => {
        if (user?.user.username) {
            setRecipientUsername(user.user.username)
        } else {
            router.replace('/add-money/crypto')
            return
        }
        setIsLoading(false)
    }, [searchParams, router, user])

    if (isLoading) {
        return <PeanutLoading />
    }

    const recipientPathSegments = [recipientUsername ?? '']

    return <PaymentPage recipient={recipientPathSegments} flow="external_wallet" />
}
