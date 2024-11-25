import Icon, { type IconNameType } from '@/components/Global/Icon'
import Link from 'next/link'

interface PaymentsFooterProps {
    href?: string
    text?: string
    icon?: IconNameType
}

export const PaymentsFooter = ({
    href = '/profile',
    text = 'See your payments.',
    icon = 'profile',
}: PaymentsFooterProps) => {
    return (
        <Link
            className="absolute bottom-0 flex h-20 w-[27rem] w-full flex-row items-center justify-start gap-2 border-t-[1px] border-black bg-purple-3 px-4.5 dark:text-black"
            href={href}
        >
            <div className="border border-n-1 p-0 px-1">
                <Icon name={icon} className="-mt-0.5" />
            </div>
            {text}
        </Link>
    )
}
