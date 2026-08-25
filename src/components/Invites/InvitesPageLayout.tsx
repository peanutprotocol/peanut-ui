'use client'

import { RAGDOLL_ENABLED } from '@/constants/ragdoll.consts'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { twMerge } from '@/utils/tw'
import CloudsBackground from '../0_Bruddle/CloudsBackground'
import starImage from '@/assets/icons/star.png'

// Same dynamic-import + kill-switch pattern as the 404. With the switch off the
// chunk + p2-es never ship and the static illustration stays. See
// ragdoll.consts.ts.
const PeanutRagdoll = RAGDOLL_ENABLED ? dynamic(() => import('@/components/PeanutRagdoll'), { ssr: false }) : null

const STAR_POSITIONS = [
    'left-[10%] md:left-[15%] lg:left-[15%] top-[15%] md:top-[20%]  size-13 md:size-14',
    'right-[10%] md:right-[15%] lg:right-[15%] top-[10%] md:top-[20%] size-10 md:size-14',
    'left-[10%] md:left-[15%] lg:left-[15%] bottom-[15%] md:bottom-[20%] size-12 md:size-14',
    'right-[10%] md:right-[15%] lg:right-[15%] bottom-[30%] size-6 md:size-14',
] as const

interface InvitesPageLayoutProps {
    image: string
    children: React.ReactNode
    // Swap the static illustration for the draggable peanut. Waitlist jail only
    // — /invite is a signup conversion surface and does not get a toy next to
    // its CTA. Falls back to `image` when the kill-switch is off.
    showRagdoll?: boolean
}

const InvitesPageLayout = ({ image, children, showRagdoll = false }: InvitesPageLayoutProps) => {
    const t = useTranslations('invites')

    return (
        <div className="flex min-h-[100dvh] flex-col">
            <div className="mx-auto flex w-full flex-grow flex-col md:flex-row">
                {/* illustration section */}
                <div
                    className={twMerge(
                        // Definite height, not min-h-*: the ragdoll canvas resolves
                        // h-full against this pane and would collapse to 0.
                        // md:h-[100dvh] below covers the desktop side.
                        'h-[55dvh]',
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
                    {/* main illustration — draggable peanut on the jail step, static image otherwise */}
                    {showRagdoll && PeanutRagdoll ? (
                        <div
                            aria-hidden="true"
                            className="relative z-10 aspect-square max-h-full w-full max-w-[80%] overflow-hidden rounded-sm border border-n-1 md:max-w-[75%] lg:max-w-xl"
                        >
                            <PeanutRagdoll />
                        </div>
                    ) : (
                        <Image
                            src={image}
                            alt={t('illustrationAlt')}
                            width={500}
                            height={500}
                            className={
                                'relative max-h-full w-full max-w-[80%] object-contain md:max-w-[75%] lg:max-w-xl'
                            }
                            priority
                        />
                    )}
                </div>

                {children}
            </div>
        </div>
    )
}

export default InvitesPageLayout
