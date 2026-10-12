import {
    ceilToMinorUnit,
    isUsdPeggedRequest,
    minorUnitDigits,
    readServerPayerAmount,
    resolveBankPayAmount,
} from '../payerAmount'

describe('isUsdPeggedRequest', () => {
    // A Peanut wallet request carries no token symbol and settles in USDC.
    it('treats a request with no token symbol as dollars', () => {
        expect(isUsdPeggedRequest(null)).toBe(true)
        expect(isUsdPeggedRequest(undefined)).toBe(true)
    })

    it('treats USD stablecoins as dollars, whatever the case', () => {
        expect(isUsdPeggedRequest('USDC')).toBe(true)
        expect(isUsdPeggedRequest('usdt')).toBe(true)
    })

    // A non-USD token amount must not be shown to a bank payer as dollars.
    it('does not treat a non-USD token as dollars', () => {
        expect(isUsdPeggedRequest('EURC')).toBe(false)
        expect(isUsdPeggedRequest('ETH')).toBe(false)
    })
})

describe('minorUnitDigits', () => {
    it('reads the decimals the currency is paid in', () => {
        expect(minorUnitDigits('EUR')).toBe(2)
        expect(minorUnitDigits('JPY')).toBe(0)
    })

    it('falls back to two on a code it does not know', () => {
        expect(minorUnitDigits('NOPE')).toBe(2)
    })
})

describe('ceilToMinorUnit', () => {
    // Rounding down leaves the request short of what it asked for, so the
    // payer is always asked for the next whole minor unit.
    it('rounds up to the smallest unit the currency has', () => {
        expect(ceilToMinorUnit(250 * 0.9237, 'EUR')).toBe(230.93)
        expect(ceilToMinorUnit(1472, 'JPY')).toBe(1472)
        expect(ceilToMinorUnit(1472.1, 'JPY')).toBe(1473)
    })

    // Binary floating point puts an exact 8.29 just above 829 minor units, and
    // a bare ceil would charge a cent nobody owes.
    it('does not round up an amount that is already exact', () => {
        expect(ceilToMinorUnit(8.29, 'USD')).toBe(8.29)
        expect(ceilToMinorUnit(250, 'USD')).toBe(250)
    })
})

describe('readServerPayerAmount', () => {
    it('reads an estimate with the dollar rate the API used', () => {
        expect(
            readServerPayerAmount({
                amount: '92.00',
                currency: 'eur',
                isEstimate: true,
                rate: { from: 'USD', to: 'EUR', rate: '0.92', source: 'bridge', asOf: null },
            })
        ).toEqual({ value: 92, currency: 'EUR', isEstimate: true, usdRate: 0.92 })
    })

    // A rate from another currency cannot convert the dollars a payer typed.
    it('keeps no rate that does not start from dollars', () => {
        const parsed = readServerPayerAmount({
            amount: '85.00',
            currency: 'EUR',
            isEstimate: true,
            rate: { from: 'GBP', to: 'EUR', rate: '1.17', source: 'reference', asOf: null },
        })
        expect(parsed?.usdRate).toBeUndefined()
    })

    it('reads a null amount as "no figure", not as a malformed answer', () => {
        expect(readServerPayerAmount({ amount: null, currency: 'EUR', isEstimate: true })).toEqual({
            value: null,
            currency: 'EUR',
            isEstimate: true,
        })
    })

    // Exact is a promise the payer copies into their bank, so only an explicit
    // `false` earns it.
    it('treats a missing isEstimate as an estimate', () => {
        expect(readServerPayerAmount({ amount: '10', currency: 'EUR' })?.isEstimate).toBe(true)
    })

    // "Nothing left to pay" is an answer the contract gives in as many words.
    // Dropping it fell back to the client conversion, which states the FULL
    // amount on a request that needs none.
    it('reads a zero amount as the figure it is', () => {
        expect(readServerPayerAmount({ amount: '0', currency: 'EUR', isEstimate: false })).toEqual({
            value: 0,
            currency: 'EUR',
            isEstimate: false,
        })
    })

    it('gives nothing for an API that predates the field or a shape it does not know', () => {
        expect(readServerPayerAmount(undefined)).toBeUndefined()
        expect(readServerPayerAmount({ amount: 'not-a-number', currency: 'EUR' })).toBeUndefined()
        expect(readServerPayerAmount({ amount: '10' })).toBeUndefined()
        expect(readServerPayerAmount({ amount: '-4', currency: 'EUR' })).toBeUndefined()
    })
})

describe('resolveBankPayAmount', () => {
    const eurEstimate = { value: 92, currency: 'EUR', isEstimate: true, usdRate: 0.92 }
    const eurExact = { value: 100, currency: 'EUR', isEstimate: false }
    const base = { accountCurrency: 'EUR', clientRate: 0, remainingUsd: 100, payerUsd: undefined }

    describe('a payer who pays what the request still needs', () => {
        it('shows the API figure when the payer typed nothing', () => {
            expect(resolveBankPayAmount({ ...base, server: eurEstimate })).toEqual({
                kind: 'local',
                value: 92,
                currency: 'EUR',
                estimate: true,
                settlesRequest: true,
            })
        })

        // Same currency as the request: the exact figure the requester asked for.
        it('shows an exact API figure as exact when the payer typed the remaining amount', () => {
            expect(resolveBankPayAmount({ ...base, server: eurExact, payerUsd: '100.00' })).toEqual({
                kind: 'local',
                value: 100,
                currency: 'EUR',
                estimate: false,
                settlesRequest: true,
            })
        })

        it('never rounds an API figure down', () => {
            const server = { value: 91.991, currency: 'EUR', isEstimate: true }
            expect(resolveBankPayAmount({ ...base, server })).toMatchObject({ value: 92 })
        })
    })

    // The bug this replaces: a payer giving $20 to a $100 request was shown the
    // API's 92 EUR, copyable, and overpaid by bank.
    describe('a payer who contributes a part', () => {
        it('converts the payer amount at the rate the API used', () => {
            expect(resolveBankPayAmount({ ...base, server: eurEstimate, payerUsd: '20' })).toEqual({
                kind: 'local',
                value: 18.4,
                currency: 'EUR',
                estimate: true,
                settlesRequest: false,
            })
        })

        // A request denominated in the account currency has no dollar rate, so
        // the payer's share of the exact figure is the best estimate there is.
        it('takes the payer share of an exact API figure, as an estimate', () => {
            expect(resolveBankPayAmount({ ...base, remainingUsd: 108, server: eurExact, payerUsd: '27' })).toEqual({
                kind: 'local',
                value: 25,
                currency: 'EUR',
                estimate: true,
                settlesRequest: false,
            })
        })

        it('passes typed dollars through to a dollar account as exact', () => {
            const server = { value: 100, currency: 'USD', isEstimate: false }
            expect(resolveBankPayAmount({ ...base, accountCurrency: 'USD', server, payerUsd: '20' })).toEqual({
                kind: 'local',
                value: 20,
                currency: 'USD',
                estimate: false,
                settlesRequest: false,
            })
        })
    })

    describe('a part-paid request', () => {
        // The API's remainder is the figure that closes the request.
        it('prefers the API remainder in a dollar account when the payer typed nothing', () => {
            const server = { value: 58.5, currency: 'USD', isEstimate: false }
            expect(resolveBankPayAmount({ ...base, accountCurrency: 'USD', remainingUsd: 60, server })).toMatchObject({
                value: 58.5,
                currency: 'USD',
                estimate: false,
            })
        })

        it('states the remaining amount in a dollar account when the payer typed nothing', () => {
            expect(
                resolveBankPayAmount({ ...base, accountCurrency: 'USD', remainingUsd: 60, server: undefined })
            ).toMatchObject({ value: 60, currency: 'USD', estimate: false, settlesRequest: true })
        })
    })

    describe('no figure from the API', () => {
        const noFigure = { value: null, currency: 'EUR', isEstimate: true }

        it('states the dollars and leaves the conversion to the bank', () => {
            expect(resolveBankPayAmount({ ...base, server: noFigure, payerUsd: '20' })).toEqual({
                kind: 'usd-only',
                usd: 20,
                accountCurrency: 'EUR',
            })
        })

        it('shows nothing on an open-amount request the payer typed nothing into', () => {
            expect(resolveBankPayAmount({ ...base, remainingUsd: undefined, server: noFigure })).toBeUndefined()
        })
    })

    // A figure in another currency than the account is not a figure for it.
    /**
     * Somebody paid part of the request from a wallet, and the API remainder
     * counted bank deposits only. Its figure is the full sum, marked exact.
     */
    describe('an API remainder that missed a payment', () => {
        it('converts the screen remainder at the API rate, as an estimate', () => {
            const server = { value: 100, currency: 'EUR', isEstimate: false, usdRate: 0.92 }
            expect(
                resolveBankPayAmount({ ...base, server, remainingUsd: 57, serverCountsAllPayments: false })
            ).toMatchObject({ kind: 'local', currency: 'EUR', value: 52.44, estimate: true })
        })

        it('states dollars alone when the API quoted no rate', () => {
            const server = { value: 100, currency: 'EUR', isEstimate: false }
            expect(resolveBankPayAmount({ ...base, server, remainingUsd: 57, serverCountsAllPayments: false })).toEqual(
                { kind: 'usd-only', usd: 57, accountCurrency: 'EUR' }
            )
        })

        it('uses the screen remainder in a dollar account', () => {
            const server = { value: 108, currency: 'USD', isEstimate: false }
            expect(
                resolveBankPayAmount({
                    ...base,
                    accountCurrency: 'USD',
                    server,
                    remainingUsd: 57,
                    serverCountsAllPayments: false,
                })
            ).toMatchObject({ value: 57, currency: 'USD' })
        })
    })

    it('ignores an API figure whose currency is not the account currency', () => {
        const server = { value: 100, currency: 'GBP', isEstimate: false }
        expect(resolveBankPayAmount({ ...base, server, clientRate: 0.92 })).toEqual({
            kind: 'local',
            value: 92,
            currency: 'EUR',
            estimate: true,
            settlesRequest: true,
        })
    })

    describe('an API that predates the field', () => {
        it('converts at the client rate, as an estimate', () => {
            expect(
                resolveBankPayAmount({ ...base, server: undefined, payerUsd: '250', clientRate: 0.9237 })
            ).toMatchObject({ value: 230.93, currency: 'EUR', estimate: true })
        })

        // A wrong number is worse than no number: the payer would send it.
        it('shows nothing while the client rate is unknown', () => {
            expect(resolveBankPayAmount({ ...base, server: undefined, payerUsd: '250' })).toBeUndefined()
        })
    })
})
