import { QR_AR_BEST_RATE } from './qrArgentinaRate.consts'

// Two stacked words in the rate's own type, the wider one at about 80% of the
// column (Roboto Flex extra-black caps run about 0.62em each), so the fold keeps
// the number's mass.
const BEST_RATE_FONT_SIZE = '32cqw'

/**
 * The rate fold's headline when no rate is younger than 12 hours, or none was
 * ever read: "Best rate" in the rate's own huge type, no number. The page never
 * prints a rate it cannot vouch for.
 */
export function QrArgentinaRateFallback() {
    const [first, ...rest] = QR_AR_BEST_RATE.split(' ')
    return (
        <div className="@container">
            <h2
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
            </h2>
        </div>
    )
}
