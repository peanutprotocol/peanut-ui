import Image from 'next/image'
import { DropIn } from '@/components/Marketing/StarLp/DropIn'
import type { UsEuAccountCaptureProps } from './usEuAccounts.types'

/**
 * A real bank-details screen as a sticker that drops in. It sits in a link, so a
 * press is the DS press: a 4px drop onto its hard shadow, which goes. The press
 * is the link's `group-active` state, not a framer `whileTap`, which would make
 * this box its own keyboard stop inside the decorative hero art. Hover adds no
 * motion (design.md § marketing components).
 */
export function UsEuAccountCapture({ src, tilt, delay, className }: UsEuAccountCaptureProps) {
    return (
        <DropIn fromTilt={tilt * 4} tilt={tilt} delay={delay} className={className}>
            <div className="overflow-hidden rounded-card border-2 border-border-default bg-background-page shadow-4 group-active:translate-x-1 group-active:translate-y-1 group-active:shadow-none motion-safe:transition-[translate,box-shadow] motion-safe:duration-instant">
                <Image
                    src={src}
                    alt=""
                    sizes="(min-width: 1024px) 480px, (min-width: 768px) 352px, 90vw"
                    className="h-auto w-full"
                    priority
                />
            </div>
        </DropIn>
    )
}
