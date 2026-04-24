import {
    applyBridgeCrossCurrencyFee,
    getCurrencyConfig,
    getOfframpCurrencyConfig,
    getPaymentRailDisplayName,
    getMinimumAmount,
    reverseBridgeCrossCurrencyFee,
} from '../bridge.utils'

describe('bridge.utils', () => {
    describe('getCurrencyConfig', () => {
        it('should return USD with correct payment rails for US', () => {
            const onrampConfig = getCurrencyConfig('US', 'onramp')
            expect(onrampConfig).toEqual({
                currency: 'usd',
                paymentRail: 'ach_push',
            })

            const offrampConfig = getCurrencyConfig('US', 'offramp')
            expect(offrampConfig).toEqual({
                currency: 'usd',
                paymentRail: 'ach',
            })
        })

        it('should return MXN with SPEI for Mexico (both onramp and offramp)', () => {
            const onrampConfig = getCurrencyConfig('MX', 'onramp')
            expect(onrampConfig).toEqual({
                currency: 'mxn',
                paymentRail: 'spei',
            })

            const offrampConfig = getCurrencyConfig('MX', 'offramp')
            expect(offrampConfig).toEqual({
                currency: 'mxn',
                paymentRail: 'spei',
            })
        })

        it('should return GBP with Faster Payments for UK', () => {
            const onrampConfig = getCurrencyConfig('GB', 'onramp')
            expect(onrampConfig).toEqual({
                currency: 'gbp',
                paymentRail: 'faster_payments',
            })

            const offrampConfig = getCurrencyConfig('GB', 'offramp')
            expect(offrampConfig).toEqual({
                currency: 'gbp',
                paymentRail: 'faster_payments',
            })
        })

        it('should handle GBR country code for UK', () => {
            const config = getCurrencyConfig('GBR', 'onramp')
            expect(config).toEqual({
                currency: 'gbp',
                paymentRail: 'faster_payments',
            })
        })

        it('should return EUR with SEPA for other countries', () => {
            const countries = ['DE', 'FR', 'IT', 'ES', 'NL', 'CA', 'AU', 'JP']

            countries.forEach((country) => {
                const onrampConfig = getCurrencyConfig(country, 'onramp')
                expect(onrampConfig).toEqual({
                    currency: 'eur',
                    paymentRail: 'sepa',
                })

                const offrampConfig = getCurrencyConfig(country, 'offramp')
                expect(offrampConfig).toEqual({
                    currency: 'eur',
                    paymentRail: 'sepa',
                })
            })
        })

        it('should handle empty country codes', () => {
            const config = getCurrencyConfig('', 'onramp')
            expect(config).toEqual({
                currency: 'eur',
                paymentRail: 'sepa',
            })
        })
    })

    describe('getOnrampCurrencyConfig', () => {
        it('should return correct onramp configuration for US', () => {
            const config = getCurrencyConfig('US', 'onramp')
            expect(config).toEqual({
                currency: 'usd',
                paymentRail: 'ach_push',
            })
        })

        it('should return correct onramp configuration for Mexico', () => {
            const config = getCurrencyConfig('MX', 'onramp')
            expect(config).toEqual({
                currency: 'mxn',
                paymentRail: 'spei',
            })
        })

        it('should return correct onramp configuration for other countries', () => {
            const config = getCurrencyConfig('DE', 'onramp')
            expect(config).toEqual({
                currency: 'eur',
                paymentRail: 'sepa',
            })
        })
    })

    describe('getOfframpCurrencyConfig', () => {
        it('should return correct offramp configuration for US', () => {
            const config = getOfframpCurrencyConfig('US')
            expect(config).toEqual({
                currency: 'usd',
                paymentRail: 'ach',
            })
        })

        it('should return correct offramp configuration for Mexico', () => {
            const config = getOfframpCurrencyConfig('MX')
            expect(config).toEqual({
                currency: 'mxn',
                paymentRail: 'spei',
            })
        })

        it('should return correct offramp configuration for other countries', () => {
            const config = getOfframpCurrencyConfig('FR')
            expect(config).toEqual({
                currency: 'eur',
                paymentRail: 'sepa',
            })
        })

        describe('getMinimumAmount', () => {
            it('should return 50 for Mexico', () => {
                const minimum = getMinimumAmount('MX')
                expect(minimum).toBe(50)
            })

            it('should return 1 for US', () => {
                const minimum = getMinimumAmount('US')
                expect(minimum).toBe(1)
            })

            it('should return 3 for UK', () => {
                const minimum = getMinimumAmount('GB')
                expect(minimum).toBe(3)
            })

            it('should return 3 for GBR country code', () => {
                const minimum = getMinimumAmount('GBR')
                expect(minimum).toBe(3)
            })

            it('should return 1 for other countries', () => {
                const minimum = getMinimumAmount('DE')
                expect(minimum).toBe(1)
            })

            it('should return 1 for empty country code', () => {
                const minimum = getMinimumAmount('')
                expect(minimum).toBe(1)
            })
        })
    })

    describe('bridge support', () => {
        it('should handle all country codes', () => {
            const countries = ['US', 'MX', 'DE', 'FR', 'IT', 'ES', 'CA', 'GB', 'AU', 'JP', '']

            countries.forEach((country) => {
                const config = getCurrencyConfig(country, 'onramp')
                expect(config).toBeDefined()
                expect(config.currency).toBeTruthy()
                expect(config.paymentRail).toBeTruthy()
            })
        })
    })

    describe('getPaymentRailDisplayName', () => {
        it('should return correct display names for supported payment rails', () => {
            expect(getPaymentRailDisplayName('ach_push')).toBe('ACH Transfer')
            expect(getPaymentRailDisplayName('ach')).toBe('ACH Transfer')
            expect(getPaymentRailDisplayName('sepa')).toBe('SEPA Transfer')
            expect(getPaymentRailDisplayName('spei')).toBe('SPEI Transfer')
            expect(getPaymentRailDisplayName('wire')).toBe('Wire Transfer')
            expect(getPaymentRailDisplayName('faster_payments')).toBe('Faster Payments')
        })

        it('should return uppercase payment rail for unsupported rails', () => {
            expect(getPaymentRailDisplayName('swift')).toBe('SWIFT')
            expect(getPaymentRailDisplayName('unknown')).toBe('UNKNOWN')
        })

        it('should handle empty strings', () => {
            expect(getPaymentRailDisplayName('')).toBe('')
        })
    })

    describe('applyBridgeCrossCurrencyFee', () => {
        // These tests mirror REAL caller usage: the Bridge side of the transfer
        // is the USDC stablecoin (not the 'USD' fiat display code). Callers must
        // pass 'USDC' so the fee helper matches backend `getBridgeDeveloperFeeParams`.

        it('applies 0.5% fee for EUR → USDC (onramp EUR deposit)', () => {
            expect(applyBridgeCrossCurrencyFee(100, 'EUR', 'USDC')).toBeCloseTo(99.5, 10)
        })

        it('applies 0.5% fee for USDC → EUR (offramp to EUR bank)', () => {
            expect(applyBridgeCrossCurrencyFee(100, 'USDC', 'EUR')).toBeCloseTo(99.5, 10)
        })

        it('applies 0.5% fee for GBP → USDC', () => {
            expect(applyBridgeCrossCurrencyFee(100, 'GBP', 'USDC')).toBeCloseTo(99.5, 10)
        })

        it('applies 0.5% fee for MXN → USDC', () => {
            expect(applyBridgeCrossCurrencyFee(100, 'MXN', 'USDC')).toBeCloseTo(99.5, 10)
        })

        it('applies 0.5% fee for USDC → MXN (offramp to Mexican bank)', () => {
            expect(applyBridgeCrossCurrencyFee(100, 'USDC', 'MXN')).toBeCloseTo(99.5, 10)
        })

        it('does not apply fee for USD → USDC (fiat rail ↔ stablecoin is fee-free)', () => {
            expect(applyBridgeCrossCurrencyFee(100, 'USD', 'USDC')).toBe(100)
        })

        it('does not apply fee for USDC → USD', () => {
            expect(applyBridgeCrossCurrencyFee(100, 'USDC', 'USD')).toBe(100)
        })

        it('does not apply fee when either side is USD (EUR → USD)', () => {
            expect(applyBridgeCrossCurrencyFee(100, 'EUR', 'USD')).toBe(100)
        })

        it('is case-insensitive', () => {
            expect(applyBridgeCrossCurrencyFee(100, 'eur', 'usdc')).toBeCloseTo(99.5, 10)
            expect(applyBridgeCrossCurrencyFee(100, 'Usd', 'Usdc')).toBe(100)
        })

        it('matches the real onramp display-quote math (EUR 500 @ 1.167)', () => {
            // 500 EUR × 1.167 rate = 583.50 gross USDC
            // after 0.5% Bridge fee = 580.5825 USDC delivered
            const gross = 500 * 1.167
            const net = applyBridgeCrossCurrencyFee(gross, 'EUR', 'USDC')
            expect(net).toBeCloseTo(580.5825, 4)
        })

        it('handles zero and negative amounts without surprises', () => {
            expect(applyBridgeCrossCurrencyFee(0, 'EUR', 'USDC')).toBe(0)
            expect(applyBridgeCrossCurrencyFee(-100, 'EUR', 'USDC')).toBeCloseTo(-99.5, 10)
        })
    })

    describe('reverseBridgeCrossCurrencyFee', () => {
        // Invariant: apply(reverse(net)) ≈ net for any amount & currency pair.
        // Guards against the classic algebra bug of using `net * (1 + rate)`
        // instead of `net / (1 - rate)` — those differ by rate² (~0.0025%).

        it('reverse(99.5) for EUR → USDC yields exactly 100 (not 99.9975)', () => {
            // The canonical sanity check: the naive `net * (1 + rate)` = 99.9975
            // would under-shoot. Correct inverse `net / (1 - rate)` lands on 100.
            expect(reverseBridgeCrossCurrencyFee(99.5, 'EUR', 'USDC')).toBeCloseTo(100, 10)
        })

        it.each([0.01, 1, 100, 999.99, 1_000_000])('apply(reverse(%f)) round-trips for EUR → USDC', (amount) => {
            const gross = reverseBridgeCrossCurrencyFee(amount, 'EUR', 'USDC')
            expect(applyBridgeCrossCurrencyFee(gross, 'EUR', 'USDC')).toBeCloseTo(amount, 4)
        })

        it.each([
            ['EUR', 'USDC'],
            ['USDC', 'EUR'],
            ['GBP', 'USDC'],
            ['MXN', 'USDC'],
            ['USDC', 'MXN'],
        ])('apply(reverse(100)) round-trips for %s → %s', (src, dst) => {
            const gross = reverseBridgeCrossCurrencyFee(100, src, dst)
            expect(applyBridgeCrossCurrencyFee(gross, src, dst)).toBeCloseTo(100, 10)
        })

        it('passes USD pairs through unchanged (no fee to reverse)', () => {
            expect(reverseBridgeCrossCurrencyFee(100, 'USD', 'USDC')).toBe(100)
            expect(reverseBridgeCrossCurrencyFee(100, 'USDC', 'USD')).toBe(100)
            expect(reverseBridgeCrossCurrencyFee(100, 'EUR', 'USD')).toBe(100)
        })

        it('is case-insensitive', () => {
            expect(reverseBridgeCrossCurrencyFee(99.5, 'eur', 'usdc')).toBeCloseTo(100, 10)
            expect(reverseBridgeCrossCurrencyFee(100, 'Usd', 'Usdc')).toBe(100)
        })
    })

    describe('payment rail differences between onramp and offramp', () => {
        it('should use different ACH payment rails for US onramp vs offramp', () => {
            const onrampConfig = getCurrencyConfig('US', 'onramp')
            const offrampConfig = getCurrencyConfig('US', 'offramp')

            expect(onrampConfig.paymentRail).toBe('ach_push')
            expect(offrampConfig.paymentRail).toBe('ach')
            expect(onrampConfig.currency).toBe(offrampConfig.currency)
        })

        it('should use same payment rails for Mexico onramp vs offramp', () => {
            const onrampConfig = getCurrencyConfig('MX', 'onramp')
            const offrampConfig = getCurrencyConfig('MX', 'offramp')

            expect(onrampConfig.paymentRail).toBe('spei')
            expect(offrampConfig.paymentRail).toBe('spei')
            expect(onrampConfig.currency).toBe(offrampConfig.currency)
        })

        it('should use same payment rails for UK onramp vs offramp', () => {
            const onrampConfig = getCurrencyConfig('GB', 'onramp')
            const offrampConfig = getCurrencyConfig('GB', 'offramp')

            expect(onrampConfig.paymentRail).toBe('faster_payments')
            expect(offrampConfig.paymentRail).toBe('faster_payments')
            expect(onrampConfig.currency).toBe(offrampConfig.currency)
        })

        it('should use same payment rails for EU countries onramp vs offramp', () => {
            const onrampConfig = getCurrencyConfig('DE', 'onramp')
            const offrampConfig = getCurrencyConfig('DE', 'offramp')

            expect(onrampConfig.paymentRail).toBe('sepa')
            expect(offrampConfig.paymentRail).toBe('sepa')
            expect(onrampConfig.currency).toBe(offrampConfig.currency)
        })
    })
})
