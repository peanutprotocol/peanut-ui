'use client'

import Carousel from '@/components/Global/Carousel'
import { Button } from '@/components/0_Bruddle/Button'
import { type ActivationStep } from '@/hooks/useActivationStatus'
import { Icon, type IconName } from '@/components/Global/Icons/Icon'
import { useRouter } from 'next/navigation'
import { useModalsContext } from '@/context/ModalsContext'
import Card from '../Global/Card'

interface ActivationCTAsProps {
    activationStep: ActivationStep
}

const STEPS: Array<{
    id: ActivationStep
    icon: IconName
    title: string
    description: string
    ctaLabel: string
    href: string
}> = [
    {
        id: 'verify',
        icon: 'globe-lock',
        title: 'Verify to get started',
        description: 'Use bank accounts and other local payments methods',
        ctaLabel: 'Verify now',
        href: '/profile/identity-verification',
    },
    {
        id: 'deposit',
        icon: 'arrow-down',
        title: 'Deposit',
        description: 'Add money to make your first payment',
        ctaLabel: 'Add money',
        href: '/add-money',
    },
    {
        id: 'outbound',
        icon: 'qr-code',
        title: 'Make your first payment',
        description: 'Start paying to Pix and MercadoPago QR codes',
        ctaLabel: 'Start Spending',
        href: '/send',
    },
]

const STEP_ORDER: ActivationStep[] = ['verify', 'deposit', 'outbound']

/**
 * carousel of activation CTAs for non-activated users on the home screen.
 * only shows steps the user still needs to complete (current + upcoming).
 * replaces the home carousel pre-activation.
 */
export default function ActivationCTAs({ activationStep }: ActivationCTAsProps) {
    const router = useRouter()
    const { setIsQRScannerOpen } = useModalsContext()

    if (activationStep === 'completed') return null

    const currentIdx = STEP_ORDER.indexOf(activationStep)
    const remainingSteps = STEPS.filter((_, i) => i >= currentIdx)

    return (
        <Carousel>
            {remainingSteps.map((step) => (
                <div key={step.id} className="embla__slide min-w-0 flex-[0_0_100%]">
                    <Card position="single" className="p-0">
                        <div className="flex flex-col items-center justify-center gap-3 px-4 py-6">
                            <div className="flex size-12 items-center justify-center rounded-full bg-primary-1">
                                <Icon name={step.icon} size={24} />
                            </div>
                            <div className="w-full text-center">
                                <div className="text-lg font-bold">{step.title}</div>
                                {step.description && <div className="text-sm text-grey-1 ">{step.description}</div>}
                            </div>
                            <Button
                                variant="purple"
                                shadowSize="4"
                                className="mt-2 w-full"
                                onClick={() => {
                                    if (step.id === 'outbound') {
                                        setIsQRScannerOpen(true)
                                    } else {
                                        router.push(step.href)
                                    }
                                }}
                            >
                                {step.ctaLabel}
                            </Button>
                        </div>
                    </Card>
                </div>
            ))}
        </Carousel>
    )
}
