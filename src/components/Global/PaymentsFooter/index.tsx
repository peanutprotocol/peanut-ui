import Icon from '@/components/Global/Icon'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'

interface PaymentsFooterProps {
    href?: string
    text?: string
    icon?: string
    className?: HTMLDivElement['className']
}

export const PaymentsFooter = ({
    href = '/history',
    text = 'See your payments',
    icon = 'profile',
    className,
}: PaymentsFooterProps) => {
    return (
        <Link
            className={twMerge(
                'flex w-full flex-row items-center justify-center gap-2 border-t-[1px] border-black bg-purple-3 p-4.5 dark:text-black',
                className
            )}
            href={href}
        >
            <div className=" border border-n-1 p-0 px-1">
                <Icon name={icon} className="-mt-0.5" fill="currentColor" />
            </div>
            {text}
        </Link>
    )
}
