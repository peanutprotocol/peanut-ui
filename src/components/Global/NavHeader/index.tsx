import { Button } from '@/components/0_Bruddle'
import Link from 'next/link'
import Icon from '../Icon'

interface NavHeaderProps {
    title: string
    href?: string
}

const NavHeader = ({ title, href }: NavHeaderProps) => {
    return (
        <div className="relative flex w-full flex-row items-center justify-between md:block">
            <Link href={href ?? '/home'} className="md:hidden">
                <Button variant="stroke" className="h-11 w-11 p-0">
                    <Icon name="arrow-prev" />
                </Button>
            </Link>
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transform pb-1 text-2xl font-bold md:relative md:left-auto md:top-auto md:translate-x-0 md:translate-y-0 md:transform-none md:pb-0 md:text-base md:font-semibold">
                {title}
            </div>
        </div>
    )
}

export default NavHeader
