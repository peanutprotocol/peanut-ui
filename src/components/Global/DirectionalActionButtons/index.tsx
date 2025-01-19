import { ArrowIcon, Button, ButtonVariant } from '@/components/0_Bruddle'
import Link from 'next/link'
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
    return (
        <div className="flex w-full flex-row items-center justify-center gap-5 sm:justify-evenly md:mx-auto md:w-fit">
            <Link href={leftButton.href} className={leftButton.disabled ? 'pointer-events-none' : ''}>
                <Button
                    variant={variant}
                    disabled={leftButton.disabled}
                    className={twMerge(
                        'w-38 cursor-pointer rounded-full',
                        leftButton.disabled && 'cursor-not-allowed opacity-50'
                    )}
                    shadowSize="4"
                >
                    <ArrowIcon size={20} />
                    <p className="text-base">{leftButton.title}</p>
                </Button>
            </Link>

            <Link href={rightButton.href} className={rightButton.disabled ? 'pointer-events-none' : ''}>
                <Button
                    variant={variant}
                    disabled={rightButton.disabled}
                    className={twMerge(
                        'w-38 cursor-pointer rounded-full',
                        rightButton.disabled && 'cursor-not-allowed opacity-50'
                    )}
                    shadowSize="4"
                >
                    <ArrowIcon className="rotate-180" />
                    <p className="text-base">{rightButton.title}</p>
                </Button>
            </Link>
        </div>
    )
}

export default DirectionalActionButtons
