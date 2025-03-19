import { ArrowIcon, Button, ButtonVariant } from '@/components/0_Bruddle'
import { twMerge } from 'tailwind-merge'
import { useRouter } from 'next/navigation'

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
        <div className="flex w-full flex-row items-center justify-center gap-5 sm:justify-evenly md:mx-auto md:w-fit">
            <Button
                variant={variant}
                disabled={leftButton.disabled}
                className={twMerge(
                    'w-38 cursor-pointer rounded-full',
                    leftButton.disabled && 'cursor-not-allowed opacity-50'
                )}
                shadowSize="4"
                onClick={() => {
                    if (leftButton.disabled) return
                    router.push(leftButton.href)
                }}
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
                onClick={() => {
                    if (rightButton.disabled) return
                    router.push(rightButton.href)
                }}
            >
                <ArrowIcon className="rotate-180" />
                <p className="text-base">{rightButton.title}</p>
            </Button>
        </div>
    )
}

export default DirectionalActionButtons
