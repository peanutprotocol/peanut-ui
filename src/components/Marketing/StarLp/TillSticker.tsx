import Image from 'next/image'
import { twMerge } from '@/utils/tw'
import { StarLpQrCode } from './StarLpQrCode'
import type { TillStickerProps } from './starLp.types'

/**
 * The counter sticker a shop tapes next to its till, as the QR pages show
 * it: the rail's mark, its "pay with QR" line in the till's language and a
 * live code. The code is the page's install link (StarLpQrCode), never the
 * rail's own payload: the sticker is the CTA dressed as the thing you will
 * see at the till. White card, black outline, hard shadow; it scales with
 * its width. The page's app link around it carries the DS press (`group`):
 * the 4px drop is the link's, the shadow goes here (`group-active`). Hover
 * adds no motion (design.md § marketing components).
 */
export function TillSticker({
    mark,
    markAlt,
    label,
    lang,
    campaign,
    slot,
    className,
    priority = false,
}: TillStickerProps) {
    return (
        <div
            className={twMerge(
                'rounded-card border-2 border-border-default bg-background-default p-2 text-center shadow-4 transition-shadow duration-instant group-active:shadow-none',
                className
            )}
        >
            <Image src={mark} alt={markAlt} priority={priority} className="mx-auto size-8" />
            <p lang={lang} className="font-roboto-flex-extrabold mt-1 text-body-xs uppercase">
                {label}
            </p>
            <StarLpQrCode campaign={campaign} slot={slot} className="mx-auto mt-2 w-[86%]" />
        </div>
    )
}
