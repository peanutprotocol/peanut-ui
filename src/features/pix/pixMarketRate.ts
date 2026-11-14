/**
 * The provider's mid-market rate as a screen states it beside its fee: the shortest rate, 2 to 6
 * decimals, at which the dollars shown convert to the reais shown with the fee shown, to the
 * centavo. The fee comes off a payout (`out`: USD × rate − fee = reais) and is added to a deposit
 * (`in`: USD × rate + fee = reais). The API floors USD × market rate to the centavo once, so the
 * rate it states can miss by a centavo; this one never does.
 */
export function pixMarketRateShown(usd: number, reais: number, fee: number, direction: 'out' | 'in'): string {
    const signedFee = direction === 'out' ? fee : -fee
    const exact = (reais + signedFee) / usd
    for (let decimals = 2; decimals < 6; decimals++) {
        const rate = exact.toFixed(decimals)
        if (Math.round((usd * Number(rate) - signedFee) * 100) === Math.round(reais * 100)) return rate
    }
    return exact.toFixed(6)
}
