'use client'

import { useEffect } from 'react'
import { useModalsContext } from '@/context/ModalsContext'
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import { recoverFromChunkError } from '@/utils/chunk-error-recovery'

export default function PaymentError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    const { setIsSupportModalOpen } = useModalsContext()

    useEffect(() => {
        console.error(error)
        // "Try again" re-renders against the same dead deployment under skew —
        // for chunk errors only a reload (re-pin to current deployment) works.
        recoverFromChunkError(error)
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
