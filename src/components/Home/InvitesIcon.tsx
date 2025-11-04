import STAR_STRAIGHT_ICON from '@/assets/icons/starStraight.svg'
import Image from 'next/image'
import { twMerge } from 'tailwind-merge'

const InvitesIcon = ({
    animate = true,
    className,
}: {
    animate?: boolean
    className?: HTMLImageElement['className']
}) => {
    return (
        <Image
            className={twMerge(animate && 'animate-star-pulsate-wiggle', className)}
            src={STAR_STRAIGHT_ICON}
            alt="star"
            width={20}
            height={20}
        />
    )
}

export default InvitesIcon
