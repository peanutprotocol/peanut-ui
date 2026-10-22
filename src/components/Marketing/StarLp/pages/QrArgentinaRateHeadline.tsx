import type { QrArgentinaRateHeadlineProps } from './qrArgentina.types'

/**
 * The rate as the fold's support line under the saving headline: "$1 =" (live)
 * or "$1 ≈" (last-known, rounded) over the ARS figure in Roboto Flex
 * extra-black, sized to the column (a container-width font size), with a small
 * "ARS" on its baseline. Screen readers get the value once, not the count.
 */
export function QrArgentinaRateHeadline({ headline, shown, numberRef }: QrArgentinaRateHeadlineProps) {
    return (
        <div className="@container">
            <p
                data-testid="qr-ar-rate-line"
                className="font-roboto-flex-extrabold font-extraBlack tracking-[-0.03em] whitespace-nowrap uppercase tabular-nums"
                // inline: the unlayered .font-roboto-flex-extrabold line-height (100%) beats a leading-* class
                style={{ fontSize: headline.fontSize, lineHeight: 0.86 }}
            >
                <span className="sr-only">{headline.label}</span>
                {/* The lead and "ARS" are shares of the fitted size, so they scale with it (inline, like the size). */}
                <span aria-hidden className="block" style={{ fontSize: '0.5em', marginBottom: '0.12em' }}>
                    {headline.lead}
                </span>
                <span ref={numberRef} aria-hidden className="flex items-baseline" style={{ columnGap: '0.05em' }}>
                    <span>{shown}</span>
                    <span style={{ fontSize: '0.26em' }}>ARS</span>
                </span>
            </p>
        </div>
    )
}
