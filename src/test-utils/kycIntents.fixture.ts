import type { KycIntents } from '@/hooks/useKycIntents'

/** Synthetic served offers for signup tests, including partial and closed bank offers. */
export const KYC_INTENTS_BY_COUNTRY: Record<string, KycIntents> = {
    AR: {
        qr: {
            available: true,
        },
        local: {
            available: true,
        },
        card: {
            available: true,
        },
        bank: {
            available: true,
            currencies: ['USD', 'EUR', 'GBP', 'MXN'],
        },
    },
    BR: {
        qr: {
            available: true,
        },
        local: {
            available: true,
        },
        card: {
            available: true,
        },
        bank: {
            available: true,
            currencies: ['USD', 'EUR', 'GBP', 'MXN'],
        },
    },
    CF: {
        qr: { available: true },
        local: { available: false, reason: 'local_residence_unsupported' },
        card: { available: true },
        bank: { available: true, currencies: ['USD', 'MXN'] },
    },
    DE: {
        qr: {
            available: true,
        },
        local: {
            available: false,
            reason: 'local_residence_unsupported',
        },
        card: {
            available: true,
        },
        bank: {
            available: true,
            currencies: ['USD', 'EUR', 'GBP', 'MXN'],
        },
    },
    GB: {
        qr: {
            available: true,
        },
        local: {
            available: false,
            reason: 'local_residence_unsupported',
        },
        card: {
            available: false,
            reason: 'geo-blocked',
        },
        bank: {
            available: false,
            currencies: [],
            reason: 'uk_resident_blocked',
        },
    },
    IN: {
        qr: {
            available: true,
        },
        local: {
            available: false,
            reason: 'local_residence_unsupported',
        },
        card: {
            available: false,
            reason: 'geo-blocked',
        },
        bank: {
            available: true,
            currencies: ['USD', 'EUR', 'GBP', 'MXN'],
        },
    },
    IR: {
        qr: {
            available: false,
            reason: 'residence_sanctioned',
        },
        local: {
            available: false,
            reason: 'residence_sanctioned',
        },
        card: {
            available: false,
            reason: 'geo-blocked',
        },
        bank: {
            available: false,
            currencies: [],
            reason: 'residence_bank_restricted',
        },
    },
    JP: {
        qr: {
            available: true,
        },
        local: {
            available: false,
            reason: 'local_residence_unsupported',
        },
        card: {
            available: true,
        },
        bank: {
            available: false,
            currencies: [],
            reason: 'residence_bank_restricted',
        },
    },
    KR: {
        qr: {
            available: true,
        },
        local: {
            available: false,
            reason: 'local_residence_unsupported',
        },
        card: {
            available: true,
        },
        bank: {
            available: false,
            currencies: [],
            reason: 'residence_bank_restricted',
        },
    },
    MK: {
        qr: {
            available: true,
        },
        local: {
            available: false,
            reason: 'local_residence_unsupported',
        },
        card: {
            available: true,
        },
        bank: {
            available: true,
            currencies: ['USD', 'EUR', 'GBP', 'MXN'],
        },
    },
    MX: {
        qr: {
            available: true,
        },
        local: {
            available: false,
            reason: 'local_residence_unsupported',
        },
        card: {
            available: true,
        },
        bank: {
            available: true,
            currencies: ['MXN', 'USD', 'EUR', 'GBP'],
        },
    },
    PT: {
        qr: {
            available: true,
        },
        local: {
            available: false,
            reason: 'local_residence_unsupported',
        },
        card: {
            available: true,
        },
        bank: {
            available: true,
            currencies: ['USD', 'EUR', 'GBP', 'MXN'],
        },
    },
    UA: {
        qr: {
            available: true,
        },
        local: {
            available: false,
            reason: 'local_residence_unsupported',
        },
        card: {
            available: false,
            reason: 'geo-blocked',
        },
        bank: {
            available: true,
            currencies: ['USD', 'EUR', 'GBP', 'MXN'],
        },
    },
    US: {
        qr: {
            available: true,
        },
        local: {
            available: false,
            reason: 'local_residence_unsupported',
        },
        card: {
            available: true,
        },
        bank: {
            available: true,
            currencies: ['USD', 'EUR', 'GBP', 'MXN'],
        },
    },
    VE: {
        qr: {
            available: true,
        },
        local: {
            available: false,
            reason: 'local_residence_unsupported',
        },
        card: {
            available: false,
            reason: 'geo-blocked',
        },
        bank: {
            available: false,
            currencies: [],
            reason: 'residence_bank_restricted',
        },
    },
}
