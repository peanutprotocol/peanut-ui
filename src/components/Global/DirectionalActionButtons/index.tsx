import { ArrowIcon, Button, ButtonVariant } from '@/components/0_Bruddle'
import { useRouter } from 'next/navigation'
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

const DirectionalActionButtons = ({
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
    return (
        <>
            <div
                onClick={() => {
                    if (leftButton.disabled) return
                    router.push(leftButton.href)
                }}
                className="flex cursor-pointer flex-col items-center gap-2.5"
            >
                <Button
                    variant={variant}
                    disabled={leftButton.disabled}
                    className={twMerge(
                        'h-14 w-14 cursor-pointer rounded-full p-0',
                        leftButton.disabled && 'cursor-not-allowed opacity-50'
                    )}
                    shadowSize="4"
                >
                    <ArrowIcon size={20} />
                </Button>
                <div className="font-semibold">{leftButton.title}</div>
            </div>
            <div
                className="flex cursor-pointer flex-col items-center gap-2.5"
                onClick={() => {
                    if (rightButton.disabled) return
                    router.push(rightButton.href)
                }}
            >
                <Button
                    variant={variant}
                    disabled={rightButton.disabled}
                    className={twMerge(
                        'h-14 w-14 cursor-pointer rounded-full p-0',
                        rightButton.disabled && 'cursor-not-allowed opacity-50'
                    )}
                    shadowSize="4"
                >
                    <ArrowIcon className="rotate-180" />
                </Button>
                <div className="font-semibold">{rightButton.title}</div>
            </div>
        </>
    )
}

export default DirectionalActionButtons
