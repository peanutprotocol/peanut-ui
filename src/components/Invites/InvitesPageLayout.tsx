'use client'

import Image from 'next/image'
import { twMerge } from 'tailwind-merge'
import CloudsBackground from '../0_Bruddle/CloudsBackground'
import starImage from '@/assets/icons/star.png'

const STAR_POSITIONS = [
    'left-[10%] md:left-[15%] lg:left-[15%] animate-rock-delay-1 top-[15%] md:top-[20%]  size-13 md:size-14',
    'right-[10%] md:right-[15%] lg:right-[15%] animate-rock top-[10%] md:top-[20%] size-10 md:size-14',
    'left-[10%] md:left-[15%] lg:left-[15%] animate-rock-delay-2 bottom-[15%] md:bottom-[20%] size-12 md:size-14',
    'right-[10%] md:right-[15%] lg:right-[15%] animate-rock-delay-2 bottom-[30%] size-6 md:size-14',
] as const

interface InvitesPageLayoutProps {
    image: string
    children: React.ReactNode
}

const InvitesPageLayout = ({ image, children }: InvitesPageLayoutProps) => {
    return (
        <div className="flex min-h-[100dvh] flex-col">
            <div className="mx-auto flex w-full flex-grow flex-col md:flex-row">
                {/* illustration section */}
                <div
                    className={twMerge(
                        'min-h-[55dvh] md:min-h-full',
                        'relative flex w-full flex-row items-center justify-center overflow-hidden bg-secondary-3/100 px-4 md:h-[100dvh] md:w-7/12 md:px-6'
                    )}
                >
                    {/* render animated star decorations */}
                    {STAR_POSITIONS.map((positions, index) => (
                        <Image
                            key={`star-${index}`}
                            src={starImage.src}
                            alt=""
                            aria-hidden
                            width={56}
                            height={56}
                            className={twMerge(positions, 'absolute z-10')}
                            priority={index === 0}
                        />
                    ))}
                    {/* animated clouds background */}
                    <CloudsBackground minimal />
                    {/* main illustration image */}
                    <Image
                        src={image}
                        alt="Section illustration"
                        width={500}
                        height={500}
                        className={'relative w-full max-w-[80%] object-contain md:max-w-[75%] lg:max-w-xl'}
                        priority
                    />
                </div>

                {children}
            </div>
        </div>
    )
}

export default InvitesPageLayout
