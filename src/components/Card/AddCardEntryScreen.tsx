'use client'
import { type FC, useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import NavHeader from '@/components/Global/NavHeader'
import CardFace from '@/components/Card/CardFace'
import { Icon } from '@/components/Global/Icons/Icon'

interface Props {
    onApply: () => void | Promise<void>
    onPrev?: () => void
    applyError?: string | null
}

const FEATURES = ['No separate card balance', 'Instant from your wallet', 'Works online & contactless'] as const

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

            {/* Preview of the card the user will receive — uses CardFace's
             * preview mode so the PAN + cardholder + expiry render as sample
             * data, without any interactive controls. */}
            <CardFace last4="0420" preview />

            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-extrabold text-n-1">Spend anywhere Visa is accepted</h1>
                <p className="text-grey-1">Use your balance at 40M+ merchants. Online, contactless.</p>
            </div>

            <ul className="flex flex-col gap-2 rounded-sm bg-primary-3 p-4 text-n-1">
                {FEATURES.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                        <Icon name="check-circle" size={16} />
                        <span>{feature}</span>
                    </li>
                ))}
            </ul>

            {applyError && <p className="text-sm text-red">{applyError}</p>}
            <Button
                onClick={handleClick}
                loading={isApplying}
                disabled={isApplying}
                variant="purple"
                shadowSize="4"
                className="mt-auto w-full"
            >
                Get your card
            </Button>
        </div>
    )
}

export default AddCardEntryScreen
