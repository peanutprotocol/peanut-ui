'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSupportModalContext } from '@/context/SupportModalContext'
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'

export default function PaymentError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    const router = useRouter()
    const { setIsSupportModalOpen } = useSupportModalContext()

    useEffect(() => {
        console.error(error)
    }, [error])

    return (
        <Card className="shadow-4">
            <Card.Header>
                <Card.Title>Something went wrong!</Card.Title>
                <Card.Description>
                    {error.message || 'An error occurred while loading the payment page.'}
                </Card.Description>
            </Card.Header>
            <Card.Content className="flex flex-col gap-3">
                <Button onClick={reset} variant="purple">
                    Try again
                </Button>
                <Button onClick={() => setIsSupportModalOpen(true)} variant="transparent" className="text-sm underline">
                    Contact Support
                </Button>
            </Card.Content>
        </Card>
    )
}
