import classNames from 'classnames'
import { Card } from '../0_Bruddle'
import Link from 'next/link'

export const HomeLink = ({
    children,
    href,
    disabled = false,
}: { children: React.ReactNode } & { href: string; disabled?: boolean }) => {
    const card = (
        <Card
            shadowSize="4"
            className={classNames(
                'flex h-24 w-24 flex-row items-center justify-center rounded-full text-center sm:h-30 sm:w-30',
                {
                    'cursor-not-allowed bg-gray-100': disabled,
                }
            )}
        >
            {children}
        </Card>
    )

    if (disabled) {
        return card
    }

    return <Link href={href}>{card}</Link>
}
