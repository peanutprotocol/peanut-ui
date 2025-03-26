import { ArrowIcon, Button, ButtonVariant } from '@/components/0_Bruddle'
import { useRouter } from 'next/navigation'
import { memo, useCallback } from 'react'
import { twMerge } from 'tailwind-merge'

interface DirectionalActionButton {
    title: string
    href: string
    disabled?: boolean
}

interface DirectionalActionButtonsProps {
    leftButton?: DirectionalActionButton
    rightButton?: DirectionalActionButton
    variant?: ButtonVariant
}

const DirectionalActionButtons = memo(
    ({
        leftButton = {
            title: 'Top up',
            href: '/topup',
            disabled: false,
        },
        rightButton = {
            title: 'Cash out',
            href: '/cashout',
            disabled: false,
        },
        variant = 'purple',
    }: DirectionalActionButtonsProps) => {
        const router = useRouter()

        const handleLeftClick = useCallback(() => {
            if (leftButton.disabled) return
            router.push(leftButton.href)
        }, [leftButton.disabled, leftButton.href, router])

        const handleRightClick = useCallback(() => {
            if (rightButton.disabled) return
            router.push(rightButton.href)
        }, [rightButton.disabled, rightButton.href, router])

        return (
            <div className="flex w-full flex-row items-center justify-center gap-5 sm:justify-evenly md:mx-auto md:w-fit">
                <Button
                    variant={variant}
                    disabled={leftButton.disabled}
                    className={twMerge(
                        'w-38 cursor-pointer rounded-full',
                        leftButton.disabled && 'cursor-not-allowed opacity-50'
                    )}
                    shadowSize="4"
                    onClick={handleLeftClick}
                >
                    <ArrowIcon size={20} />
                    <p className="text-base">{leftButton.title}</p>
                </Button>
                <Button
                    variant={variant}
                    disabled={rightButton.disabled}
                    className={twMerge(
                        'w-38 cursor-pointer rounded-full',
                        rightButton.disabled && 'cursor-not-allowed opacity-50'
                    )}
                    shadowSize="4"
                    onClick={handleRightClick}
                >
                    <ArrowIcon className="rotate-180" />
                    <p className="text-base">{rightButton.title}</p>
                </Button>
            </div>
        )
    }
)

DirectionalActionButtons.displayName = 'DirectionalActionButtons'

export default DirectionalActionButtons
