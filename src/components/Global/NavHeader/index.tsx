import { Button } from '@/components/0_Bruddle'
import Link from 'next/link'
import { Icon } from '../Icons/Icon'

interface NavHeaderProps {
    title?: string
    href?: string
    onclick?: () => void
    hideLabel?: boolean
}

const NavHeader = ({ title, onclick, href, hideLabel = false }: NavHeaderProps) => {
    return (
        <div className="relative flex w-full flex-row items-center justify-between md:block">
            {!onclick ? (
                <Link href={href ?? '/home'} className="md:hidden">
                    <Button variant="stroke" className="h-7 w-7 p-0">
                        <Icon name="chevron-up" size={32} className="h-8 w-8 -rotate-90" />
                    </Button>
                </Link>
            ) : (
                <Button onClick={onclick} variant="stroke" className="h-7 w-7 p-0">
                    <Icon name="chevron-up" size={32} className="h-8 w-8 -rotate-90" />
                </Button>
            )}
            {!hideLabel && (
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transform pb-1 text-lg font-bold md:relative md:left-auto md:top-auto md:translate-x-0 md:translate-y-0 md:transform-none md:pb-0 md:text-base md:font-semibold">
                    {title}
                </div>
            )}
        </div>
    )
}

export default NavHeader
