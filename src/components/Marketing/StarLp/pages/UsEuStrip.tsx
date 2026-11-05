import { twMerge } from '@/utils/tw'
import { US_EU_STRIP_TONE } from './usEuAccounts.consts'
import type { UsEuStripProps } from './usEuAccounts.types'

/** While its story beat is hidden, a part of the strip sits 10px low and clear; it rises when the beat shows. */
const RISE =
    'motion-safe:transition-[opacity,translate] motion-safe:duration-slow motion-safe:ease-spring group-data-[shown=false]/strip:translate-y-2.5 group-data-[shown=false]/strip:opacity-0'

/**
 * One strip of the request fold (Split's proof rows). Inside a StorySequence
 * beat marked `group/strip`, the strip itself only fades
 * (star-lp-own-entrance), so its tilt stays put, while the disc and then the
 * words rise softly.
 */
export function UsEuStrip({ tone, initial, who, aside, className, children }: UsEuStripProps) {
    const ground = US_EU_STRIP_TONE[tone]
    return (
        <div
            className={twMerge(
                'star-lp-own-entrance flex items-center gap-3 rounded-card border-2 border-border-default p-4 text-foreground-primary shadow-4 md:gap-4 md:px-6',
                ground.strip,
                className
            )}
        >
            <span
                className={twMerge(
                    'grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-border-default text-body-m-semibold',
                    ground.disc,
                    RISE
                )}
            >
                {initial}
            </span>
            <span
                className={twMerge(
                    'grid min-w-0 flex-1 gap-1 motion-safe:delay-[70ms]',
                    aside && 'xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center xl:gap-x-4',
                    RISE
                )}
            >
                <span className="block text-body-s-semibold lg:text-body-m-semibold">{who}</span>
                {aside && (
                    <span className="mt-4 mb-2 justify-self-start xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:my-0">
                        {aside}
                    </span>
                )}
                <span className="block min-w-0 text-heading-xs lg:text-heading-s">{children}</span>
            </span>
        </div>
    )
}
