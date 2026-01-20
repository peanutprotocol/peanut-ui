'use client'

import Card from '@/components/Global/Card'
import { Icon } from '@/components/Global/Icons/Icon'
import { Button } from '@/components/0_Bruddle/Button'
import { useRouter } from 'next/navigation'

/**
 * displays a card prompting users without kyc to complete verification
 * to unlock fiat limits
 */
export default function FiatLimitsLockedCard() {
    const router = useRouter()

    return (
        <div className="space-y-2">
            <h2 className="font-bold">Unlock fiat limits</h2>
            <Card position="single" className="p-0">
                <div className="flex flex-col items-center justify-center gap-3 px-4 py-6">
                    <div className="flex size-10 items-center justify-center rounded-full bg-primary-1">
                        <Icon name="globe-lock" size={20} />
                    </div>
                    <div className="text-center">
                        <div className="font-bold">Fiat limits locked</div>
                        <div className="mt-1 text-sm text-grey-1">
                            Complete identity verification to unlock fiat payments and see your limits
                        </div>
                    </div>
                    <Button
                        variant="purple"
                        shadowSize="4"
                        size="medium"
                        onClick={() => router.push('/profile/identity-verification')}
                        className="mt-2"
                    >
                        Verify identity
                    </Button>
                </div>
            </Card>
        </div>
    )
}
