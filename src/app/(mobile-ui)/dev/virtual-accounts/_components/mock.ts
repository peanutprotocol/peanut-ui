import type { DepositAccountView, VaComingSoon, VaCurrency, VaRail } from './types'

/** the mock user — the beneficiary name once the Virtual Accounts SKU is on */
export const USER_NAME = 'Ana Pérez'

/**
 * Mock rails for the prototype. USD and EUR values come from the 2026-08-24
 * Bridge production PoC (mono product/providers/fiat/evidence/poc-bridge-2026-08.md):
 * beneficiary "Peanut" at Lead Bank routing 101019644 for USD; beneficiary
 * "Bridge Building Sp. Z.o.o." at Banking Circle S.A. (BIC BCIRLULL, LU IBAN)
 * for EUR. Account numbers and IBANs are samples, not live accounts. GBP and
 * MXN were not in the PoC: their field shapes copy AddMoneyBankDetails, their
 * values are placeholders.
 */
export const RAILS: Record<VaCurrency, VaRail> = {
    usd: {
        currency: 'usd',
        corridor: 'ACH_US',
        code: 'USD',
        railName: 'ACH or wire',
        flagIso2: 'us',
        pickerBody: '1–3 business days',
        accepted: 'ACH · domestic wire',
        eta: 'ACH arrives in 1–3 business days, wires the same day. Payments from other people or companies: up to $4,000 each.',
        pooledHolderNotice:
            'The account holder is Peanut, not your name. That is expected — the payment reference routes the money to you.',
        returnedExample: { amount: '$1,200.00', payer: 'Deel', date: '27 Aug' },
        v1: {
            beneficiaryName: 'Peanut',
            bankName: 'Lead Bank',
            bankAddress: '1801 Main St, Kansas City, MO 64108',
            accountNumber: '211055839021',
            routingNumber: '101019644',
            memo: 'BRG7K2M4QX',
        },
    },
    eur: {
        currency: 'eur',
        corridor: 'SEPA_EU',
        code: 'EUR',
        railName: 'SEPA',
        flagIso2: 'eu',
        pickerBody: 'Same business day',
        accepted: 'SEPA credit transfer',
        eta: 'SEPA usually arrives the same business day, at most in 2.',
        pooledHolderNotice:
            'The account holder is Bridge Building Sp. Z.o.o., the partner that holds euro accounts for Peanut. Payers see that name, not yours. That is expected.',
        returnedExample: { amount: '€500.00', payer: 'ACME GmbH', date: '28 Aug' },
        v1: {
            beneficiaryName: 'Bridge Building Sp. Z.o.o.',
            bankName: 'Banking Circle S.A.',
            bankAddress: '2 Boulevard de la Foire, L-1528 Luxembourg',
            iban: 'LU28 0019 4006 4475 0000',
            bic: 'BCIRLULL',
            memo: 'BRG5H2K9AB',
        },
    },
    gbp: {
        currency: 'gbp',
        corridor: 'FASTER_PAYMENTS_GB',
        code: 'GBP',
        railName: 'Faster Payments',
        flagIso2: 'gb',
        pickerBody: 'Within minutes',
        accepted: 'Faster Payments · CHAPS',
        eta: 'Faster Payments usually arrive within minutes.',
        pooledHolderNotice:
            'The account holder is Bridge Building Sp. Z.o.o., the partner that holds sterling accounts for Peanut. Payers see that name, not yours. That is expected.',
        returnedExample: { amount: '£800.00', payer: 'Upwork', date: '26 Aug' },
        v1: {
            beneficiaryName: 'Bridge Building Sp. Z.o.o.',
            bankName: 'Sample Bank Ltd',
            sortCode: '04-00-04',
            accountNumber: '12345678',
            memo: 'BRGA9Q3ZLM',
        },
        unverified: true,
    },
    mxn: {
        currency: 'mxn',
        corridor: 'SPEI_MX',
        code: 'MXN',
        railName: 'SPEI',
        flagIso2: 'mx',
        pickerBody: 'Within minutes',
        accepted: 'SPEI',
        eta: 'SPEI usually arrives within minutes.',
        pooledHolderNotice:
            'The account holder is Bridge Building Sp. Z.o.o., the partner that holds peso accounts for Peanut. Payers see that name, not yours. That is expected.',
        returnedExample: { amount: 'MX$9,000.00', payer: 'Toptal', date: '25 Aug' },
        v1: {
            beneficiaryName: 'Bridge Building Sp. Z.o.o.',
            bankName: 'Sample Bank S.A.',
            clabe: '012180001234567890',
            memo: 'BRGC4T8NRV',
        },
        unverified: true,
    },
}

export const RAIL_ORDER: VaCurrency[] = ['usd', 'eur', 'gbp', 'mxn']

/**
 * ARS and BRL stay on Manteca in V1 (plan §0): own-account deposits through
 * the existing Add money flow, no third-party surface. Shown disabled so the
 * picker is honest per corridor, with the pointer to where own transfers go.
 */
export const COMING_SOON: VaComingSoon[] = [
    { code: 'ARS', railName: 'Bank transfer', flagIso2: 'ar' },
    { code: 'BRL', railName: 'PIX', flagIso2: 'br' },
]

/**
 * What `GET /users/deposit-accounts` would return for one corridor. `sku`
 * is the memo fork: the Bridge adapter provisions a VIRTUAL_ACCOUNT instead
 * of a STATIC_TEMPLATE (plan §2.5) and only `matching` + two instruction
 * fields change. Nothing on the read side branches on the provider.
 */
export function mockDepositAccount(rail: VaRail, sku: boolean): DepositAccountView {
    return {
        corridor: rail.corridor,
        currency: rail.code,
        status: 'active',
        matching: sku
            ? { amount: 'flexible', memo: 'none', sender: 'any', nameOnAccount: 'user' }
            : { amount: 'flexible', memo: 'required', sender: 'any', nameOnAccount: 'provider' },
        instructions: sku ? { ...rail.v1, beneficiaryName: USER_NAME, memo: null } : rail.v1,
    }
}
