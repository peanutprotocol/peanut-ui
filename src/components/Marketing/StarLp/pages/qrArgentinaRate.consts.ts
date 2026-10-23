/** The rate line when no rate is younger than 12 hours. */
export const QR_AR_BEST_RATE = 'Best rate'

/**
 * The fold's headline and its footnote: the one dated card comparison
 * pricing.md allows (rate_advantage usd-to-ars, dated_evidence, and § Savings
 * Message (Argentina QR)). On 2026-09-22 an indicative USD-funded 100,000 ARS
 * scenario put Peanut at 1,564.93 ARS/USD against a Visa quote of 1,514.9134
 * plus an assumed 3% issuer fee: 6.02% lower. The file requires the date, USD
 * funding, the assumed fee and the indicative nature stated together, never as
 * a live result or a durable range, so the footnote stays with the headline and
 * nothing on the page derives a saving from the live rate. Evidence:
 * mono projects/seo-content-workstream-c/review/savings-verification-2026-09-22/.
 */
export const QR_AR_SAVING_HEADLINE = ['About 6% less', 'than a foreign card.'] as const
// The asterisk is drawn by the fold (aria-hidden), so screen readers never hear it.
export const QR_AR_SAVING_FOOTNOTE =
    "Indicative comparison on 22 Sep 2026, for a USD-funded 100,000 ARS QR payment. At Peanut's quote it cost 6.02% less than at a Visa quote plus an assumed 3% issuer fee. Not a live result. Card fees and exchange rates vary."
