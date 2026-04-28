'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { type ActivationStep } from '@/hooks/useActivationStatus'
import { Icon, type IconName } from '@/components/Global/Icons/Icon'
import { useRouter } from 'next/navigation'
import { useModalsContext } from '@/context/ModalsContext'
import Card from '../Global/Card'
import { useEffect, useRef } from 'react'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'

interface ActivationCTAsProps {
    activationStep: ActivationStep
    /** Dismisses the card step (persists locally). Only relevant for step='card'. */
    onDismissCard?: () => void
}

interface StepConfig {
    icon: IconName
    iconBg: string
    title: string
    description: string
    ctaLabel: string
    href: string
    dismissable?: boolean
}

const STEPS: Record<Exclude<ActivationStep, 'completed'>, StepConfig> = {
    verify: {
        icon: 'globe-lock',
        iconBg: 'bg-primary-1',
        title: 'Verify to get started',
        description: 'Use bank accounts and other local payments methods',
        ctaLabel: 'Verify now',
        href: '/profile/identity-verification',
    },
    deposit: {
        icon: 'arrow-down',
        iconBg: 'bg-primary-1',
        title: 'Deposit',
        description: 'Add money to make your first payment',
        ctaLabel: 'Add money',
        href: '/add-money',
    },
    card: {
        icon: 'credit-card',
        iconBg: 'bg-yellow-1',
        title: 'Spend anywhere Visa is accepted',
        description: 'Use your balance at 40m+ merchants. Online, contactless.',
        ctaLabel: 'Get your card',
        href: '/card',
        dismissable: true,
    },
    outbound: {
        icon: 'qr-code',
        iconBg: 'bg-primary-1',
        title: 'Make your first payment',
        description: 'Start paying to Pix and MercadoPago QR codes',
        ctaLabel: 'Start Spending',
        href: '/send',
    },
}

/**
 * single activation CTA for non-activated users on the home screen.
 * shows only the current step the user needs to complete.
 */
export default function ActivationCTAs({ activationStep, onDismissCard }: ActivationCTAsProps) {
    const router = useRouter()
    const { setIsQRScannerOpen } = useModalsContext()

    const lastTrackedStep = useRef<ActivationStep | null>(null)
    useEffect(() => {
        if (activationStep !== 'completed' && activationStep !== lastTrackedStep.current) {
            lastTrackedStep.current = activationStep
            posthog.capture(ANALYTICS_EVENTS.ACTIVATION_STEP_VIEWED, {
                step: activationStep,
            })
        }
    }, [activationStep])

    if (activationStep === 'completed') return null

    const step = STEPS[activationStep]

    return (
        <Card position="single" className="p-0">
            <div className="flex flex-col items-center justify-center gap-3 px-4 py-6">
                <div className={`flex size-12 items-center justify-center rounded-full ${step.iconBg}`}>
                    <Icon name={step.icon} size={24} />
                </div>
                <div className="w-full text-center">
                    <div className="text-lg font-bold">{step.title}</div>
                    <div className="text-sm text-grey-1">{step.description}</div>
                </div>
                <Button
                    variant="purple"
                    shadowSize="4"
                    className="mt-2 w-full"
                    onClick={() => {
                        if (activationStep === 'outbound') {
                            setIsQRScannerOpen(true)
                        } else {
                            router.push(step.href)
                        }
                    }}
                >
                    {step.ctaLabel}
                </Button>
                {step.dismissable && onDismissCard && (
                    <button type="button" onClick={onDismissCard} className="text-sm font-medium text-black underline">
                        Maybe later
                    </button>
                )}
            </div>
        </Card>
    )
}
