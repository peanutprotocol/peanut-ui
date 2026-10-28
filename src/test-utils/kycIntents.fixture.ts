import type { KycIntents } from '@/hooks/useKycIntents'

/**
 * GET /config/kyc-intents answers for the countries the sign-up tests use,
 * as the API's rules gave them on 2026-10-27 (peanut-api-ts
 * `intentAvailability`). Bank closed for JP and KR, card for GB, IN, UA and
 * VE, local only in AR and BR.
 */
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
        },
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
            reason: 'residence_bank_restricted',
        },
    },
}
