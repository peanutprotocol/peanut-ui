import Icon, { type IconNameType } from '@/components/Global/Icon'
import Link from 'next/link'
import { Button } from '@/components/0_Bruddle'

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
        <Link href={href}>
            <Button variant="stroke" className="flex flex-row justify-between text-nowrap">
                <div className="border border-n-1 p-0 px-1">
                    <Icon name={icon} className="-mt-0.5" />
                </div>
                {text}
            </Button>
        </Link>
    )
}
