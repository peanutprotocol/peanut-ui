/**
 * USD for a BRL price, as the app's amount field shows it: floored to the
 * cent (AmountInput → formatTokenAmount), so the page and the Pay screen agree.
 */
export function qrBrazilUsdFor(brl: number, usdBrl: number): string {
    return (Math.floor((brl / usdBrl) * 100) / 100).toFixed(2)
}
