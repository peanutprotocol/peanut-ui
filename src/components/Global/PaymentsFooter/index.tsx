import { Button, ButtonVariant } from '@/components/0_Bruddle'
import Icon from '@/components/Global/Icon'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'

interface PaymentsFooterProps {
    href?: string
    text?: string
    icon?: string
    className?: HTMLDivElement['className']
    variant?: ButtonVariant
}

export const PaymentsFooter = ({
    href = '/history',
    text = 'See your payments',
    icon = 'profile',
    className,
    variant,
}: PaymentsFooterProps) => {
    return (
        <Link href={href}>
            <Button
                variant={variant ? variant : 'stroke'}
                className={twMerge('flex flex-row justify-center text-nowrap', className)}
            >
                <div className="border border-n-1 p-0 px-1">
                    <Icon name={icon} className="-mt-0.5" fill="currentColor" />
                </div>
                {text}
            </Button>
        </Link>
    )
}
