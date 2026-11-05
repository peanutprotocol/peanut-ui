import { QR_AR_BEST_RATE } from './qrArgentinaRate.consts'

// Two stacked words in the rate's own type, the wider one at about 55% of the
// column like the number's line (Roboto Flex extra-black caps run about 0.62em
// each), so the fold keeps the number's mass.
const BEST_RATE_FONT_SIZE = '22cqw'

/**
 * The rate fold's support line when no rate is younger than 12 hours, or none
 * was ever read: "Best rate" in the rate's own type, no number. The page never
 * prints a rate it cannot vouch for.
 */
export function QrArgentinaRateFallback() {
    const [first, ...rest] = QR_AR_BEST_RATE.split(' ')
    return (
        <div className="@container">
            <p
                data-testid="qr-ar-rate-line"
                // lighter tracking than the number's and no kerning: otherwise the R and A of RATE touch at this size
                className="font-roboto-flex-extrabold font-extraBlack tracking-[-0.01em] whitespace-nowrap uppercase"
                // inline: the unlayered .font-roboto-flex-extrabold line-height (100%) beats a leading-* class
                style={{ fontSize: BEST_RATE_FONT_SIZE, lineHeight: 0.86, fontKerning: 'none' }}
            >
                <span className="sr-only">{QR_AR_BEST_RATE}</span>
                <span aria-hidden className="block">
                    {first}
                </span>
                <span aria-hidden className="block">
                    {rest.join(' ')}
                </span>
            </p>
        </div>
    )
}
