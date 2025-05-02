import { Button } from '@/components/0_Bruddle'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'
import { Icon, IconName } from '../Icons/Icon'

interface NavHeaderProps {
    onPrev?: () => void
    disableBackBtn?: boolean
    title?: string
    href?: string
    hideLabel?: boolean
    icon?: IconName
}

const NavHeader = ({ title, icon = 'chevron-up', href, hideLabel = false, onPrev, disableBackBtn }: NavHeaderProps) => {
    return (
        <div className="relative flex w-full flex-row items-center justify-between md:block">
            {!onPrev ? (
                <Link href={href ?? '/home'} className="md:hidden">
                    <Button variant="stroke" className="h-7 w-7 p-0">
                        <Icon
                            name={icon}
                            size={32}
                            className={twMerge('h-8 w-8', icon === 'chevron-up' && ' -rotate-90')}
                        />
                    </Button>
                </Link>
            ) : (
                <Button variant="stroke" className="h-7 w-7 p-0" onClick={onPrev} disabled={disableBackBtn}>
                    <Icon
                        name={icon}
                        size={32}
                        className={twMerge('h-8 w-8', icon === 'chevron-up' && ' -rotate-90')}
                    />
                </Button>
            )}
            {!hideLabel && (
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transform pb-1 text-lg font-bold md:relative md:left-auto md:top-auto md:hidden md:translate-x-0 md:translate-y-0 md:transform-none md:pb-0 md:text-base md:font-semibold">
                    {title}
                </div>
            )}
        </div>
    )
}

export default NavHeader
