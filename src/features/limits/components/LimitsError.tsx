'use client'
import { Button } from '@/components/0_Bruddle/Button'
import EmptyState from '@/components/Global/EmptyStates/EmptyState'
import { useRouter } from 'next/navigation'

export default function LimitsError() {
    const router = useRouter()
    return (
        <div className="px-2">
            <EmptyState
                title="Something went wrong"
                description={'Failed to load limits. Please try again.'}
                icon="alert"
            />
            <div className="mt-4 flex justify-center">
                <Button icon="retry" shadowSize="4" onClick={() => router.refresh()}>
                    Retry
                </Button>
            </div>
        </div>
    )
}
