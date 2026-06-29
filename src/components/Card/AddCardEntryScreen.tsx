'use client'
import { type FC, useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import ErrorAlert from '@/components/Global/ErrorAlert'
import NavHeader from '@/components/Global/NavHeader'
import { ScaledPixelatedCardFace } from '@/components/Card/share-asset/ScaledPixelatedCardFace'
import { Icon } from '@/components/Global/Icons/Icon'

interface Props {
    onApply: () => void | Promise<void>
    onPrev?: () => void
    applyError?: string | null
}

const FEATURES = ['One unified balance', 'Under your control', 'Works online & contactless'] as const

const AddCardEntryScreen: FC<Props> = ({ onApply, onPrev, applyError }) => {
    const [isApplying, setIsApplying] = useState(false)

    const handleClick = async () => {
        setIsApplying(true)
        try {
            await onApply()
        } finally {
            setIsApplying(false)
        }
    }
    return (
        <div className="flex min-h-[inherit] flex-col gap-6">
            <NavHeader title="Add Card" onPrev={onPrev} />

            {/* Pixelated card — keeps the anticipation/tease intact through
                the "Get your card" CTA, matching the /shhhhh + eligibility
                screens. The card's real details are still hidden until
                issuance, so the same chunky-pixel treatment applies. */}
            <ScaledPixelatedCardFace last4="????" blurAll />

            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-extrabold text-n-1">Spend anywhere Visa is accepted</h1>
                <p className="text-grey-1">Use your balance at 150M+ merchants. Online, contactless, yours.</p>
            </div>

            <ul className="flex flex-col gap-2 rounded-sm bg-primary-3 p-4 text-n-1">
                {FEATURES.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                        <Icon name="check-circle" size={16} />
                        <span>{feature}</span>
                    </li>
                ))}
            </ul>

            {/* Error above the CTA, not below: the (mobile-ui) layout pins a
             * QR FAB at the bottom-center that pokes ~27px UP into the page,
             * so any text rendered immediately below the CTA gets bisected
             * by it. Other surfaces (Withdraw, Send link) get away with
             * below-CTA because their pages scroll; this one fits the
             * viewport so the FAB collision is unavoidable. */}
            {applyError && <ErrorAlert description={applyError} />}
            <Button
                onClick={handleClick}
                loading={isApplying}
                disabled={isApplying}
                variant="purple"
                shadowSize="4"
                className="w-full"
            >
                Get your card
            </Button>
        </div>
    )
}

export default AddCardEntryScreen
