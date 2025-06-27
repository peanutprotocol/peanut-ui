import {
    getCurrencyConfig,
    getOnrampCurrencyConfig,
    getOfframpCurrencyConfig,
    getCurrencySymbol,
    getPaymentRailDisplayName,
    type BridgeOperationType,
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
                paymentRail: 'ach_pull',
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

        it('should return EUR with SEPA for other countries', () => {
            const countries = ['DE', 'FR', 'IT', 'ES', 'NL', 'CA', 'GB', 'AU', 'JP']

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
            const config = getOnrampCurrencyConfig('US')
            expect(config).toEqual({
                currency: 'usd',
                paymentRail: 'ach_push',
            })
        })

        it('should return correct onramp configuration for Mexico', () => {
            const config = getOnrampCurrencyConfig('MX')
            expect(config).toEqual({
                currency: 'mxn',
                paymentRail: 'spei',
            })
        })

        it('should return correct onramp configuration for other countries', () => {
            const config = getOnrampCurrencyConfig('DE')
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
                paymentRail: 'ach_pull',
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

    describe('getCurrencySymbol', () => {
        it('should return correct symbols for supported currencies', () => {
            expect(getCurrencySymbol('usd')).toBe('$')
            expect(getCurrencySymbol('USD')).toBe('$')
            expect(getCurrencySymbol('eur')).toBe('€')
            expect(getCurrencySymbol('EUR')).toBe('€')
            expect(getCurrencySymbol('mxn')).toBe('$')
            expect(getCurrencySymbol('MXN')).toBe('$')
        })

        it('should return uppercase currency code for unsupported currencies', () => {
            expect(getCurrencySymbol('gbp')).toBe('GBP')
            expect(getCurrencySymbol('jpy')).toBe('JPY')
            expect(getCurrencySymbol('cad')).toBe('CAD')
        })

        it('should handle empty strings', () => {
            expect(getCurrencySymbol('')).toBe('')
        })
    })

    describe('getPaymentRailDisplayName', () => {
        it('should return correct display names for supported payment rails', () => {
            expect(getPaymentRailDisplayName('ach_push')).toBe('ACH Transfer')
            expect(getPaymentRailDisplayName('ach_pull')).toBe('ACH Transfer')
            expect(getPaymentRailDisplayName('sepa')).toBe('SEPA Transfer')
            expect(getPaymentRailDisplayName('spei')).toBe('SPEI Transfer')
            expect(getPaymentRailDisplayName('wire')).toBe('Wire Transfer')
        })

        it('should return uppercase payment rail for unsupported rails', () => {
            expect(getPaymentRailDisplayName('swift')).toBe('SWIFT')
            expect(getPaymentRailDisplayName('unknown')).toBe('UNKNOWN')
        })

        it('should handle empty strings', () => {
            expect(getPaymentRailDisplayName('')).toBe('')
        })
    })

    describe('payment rail differences between onramp and offramp', () => {
        it('should use different ACH payment rails for US onramp vs offramp', () => {
            const onrampConfig = getCurrencyConfig('US', 'onramp')
            const offrampConfig = getCurrencyConfig('US', 'offramp')

            expect(onrampConfig.paymentRail).toBe('ach_push')
            expect(offrampConfig.paymentRail).toBe('ach_pull')
            expect(onrampConfig.currency).toBe(offrampConfig.currency)
        })

        it('should use same payment rails for Mexico onramp vs offramp', () => {
            const onrampConfig = getCurrencyConfig('MX', 'onramp')
            const offrampConfig = getCurrencyConfig('MX', 'offramp')

            expect(onrampConfig.paymentRail).toBe('spei')
            expect(offrampConfig.paymentRail).toBe('spei')
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
