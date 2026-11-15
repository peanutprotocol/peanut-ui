import HandPeace from '@/assets/illustrations/hand-peace.svg'
import { PopIn } from './PopIn'
import { Wiggle } from './Wiggle'
import type { CloseGloveCtaProps } from './starLp.types'

/**
 * The close fold's CTA with the peace glove beside it (the mock's close). Pair it
 * with `decoration={<></>}` on CloseFold, so no sparkles float as well. Below xs
 * the glove stacks above the CTA so the large button keeps a one-line label at 320.
 */
export function CloseGloveCta({ children }: CloseGloveCtaProps) {
    return (
        <div className="flex flex-col items-center gap-3 xs:flex-row md:gap-4">
            <PopIn tilt={-10} className="pointer-events-none w-12 shrink-0 md:w-16">
                <Wiggle kind="wobble">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={HandPeace.src}
                        width={HandPeace.width}
                        height={HandPeace.height}
                        alt=""
                        aria-hidden
                        loading="lazy"
                    />
                </Wiggle>
            </PopIn>
            {children}
        </div>
    )
}
