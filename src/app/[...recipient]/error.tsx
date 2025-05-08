'use client'

import { Button, Card } from '@/components/0_Bruddle'
import { useEffect } from 'react'

export default function PaymentError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
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
            <Card.Content>
                <Button onClick={reset} variant="purple">
                    Try again
                </Button>
            </Card.Content>
        </Card>
    )
}
