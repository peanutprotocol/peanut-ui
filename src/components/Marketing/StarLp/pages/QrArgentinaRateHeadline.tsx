import { formatUsdArsRate } from './qrArgentinaRate.utils'
import type { QrArgentinaRateHeadlineProps } from './qrArgentina.types'

/**
 * Today's rate as the fold's h2: "$1 =" over the live ARS figure in Roboto Flex
 * extra-black, sized to the column (a container-width font size), with a small
 * "ARS" on its baseline. Screen readers get the live rate once, not the count.
 */
export function QrArgentinaRateHeadline({ headline, shown, numberRef }: QrArgentinaRateHeadlineProps) {
    return (
        <div className="@container">
            <h2
                className="font-roboto-flex-extrabold font-extraBlack tracking-[-0.03em] whitespace-nowrap uppercase tabular-nums"
                // inline: the unlayered .font-roboto-flex-extrabold line-height (100%) beats a leading-* class
                style={{ fontSize: headline.fontSize, lineHeight: 0.86 }}
            >
                <span className="sr-only">{`$1 = ${headline.value} ARS`}</span>
                <span aria-hidden className="mb-[0.12em] block text-[0.5em]">
                    $1 =
                </span>
                <span ref={numberRef} aria-hidden className="flex items-baseline gap-[0.05em]">
                    <span>{formatUsdArsRate(shown)}</span>
                    <span className="text-[0.26em]">ARS</span>
                </span>
            </h2>
        </div>
    )
}
