import {
    aveniaDepositPhase,
    aveniaSetupState,
    aveniaWithdrawAmount,
    aveniaWithdrawRefusalKey,
    quoteMovedAgainstUser,
    brazilPixPath,
    completePixKey,
    countdownLabel,
    maskedTaxIdKind,
    pixKeyVerdict,
    toApiDecimal,
} from '../avenia.utils'
import { DEMO_AVENIA_BR_CODE } from '@/constants/demo-data'
import type { RailCapability } from '@/types/capabilities'

const rail = (status: RailCapability['status']): RailCapability => ({
    id: 'avenia.pix_br',
    provider: 'avenia',
    method: 'PIX_BR',
    channel: 'bank',
    country: 'BR',
    currency: 'BRL',
    status,
})

describe('brazilPixPath', () => {
    const base = {
        isLoading: false,
        aveniaRail: undefined,
        identityVerified: true,
        verifiedResidence: 'BR',
        unavailable: false,
    }

    it('waits while the capabilities load', () => {
        expect(brazilPixPath({ ...base, isLoading: true })).toBe('loading')
    })

    it('sends a user who holds the Avenia rail to Avenia, in any state', () => {
        for (const status of ['enabled', 'requires-info', 'blocked'] as const) {
            expect(brazilPixPath({ ...base, aveniaRail: rail(status), identityVerified: false })).toBe('avenia')
        }
    })

    it("offers Avenia's first use to a verified Brazilian resident", () => {
        expect(brazilPixPath(base)).toBe('avenia')
        expect(brazilPixPath({ ...base, verifiedResidence: 'br' })).toBe('avenia')
    })

    it('keeps Manteca for anyone else, and after the API refused Avenia this session', () => {
        expect(brazilPixPath({ ...base, identityVerified: false })).toBe('manteca')
        expect(brazilPixPath({ ...base, verifiedResidence: 'AR' })).toBe('manteca')
        expect(brazilPixPath({ ...base, verifiedResidence: null })).toBe('manteca')
        expect(brazilPixPath({ ...base, unavailable: true })).toBe('manteca')
    })
})

describe('aveniaSetupState', () => {
    it('is ready only on an enabled rail and blocked on a refused one', () => {
        expect(aveniaSetupState(rail('enabled'))).toBe('ready')
        expect(aveniaSetupState(rail('blocked'))).toBe('blocked')
        expect(aveniaSetupState(rail('requires-info'))).toBe('verify')
        expect(aveniaSetupState(rail('pending'))).toBe('verify')
        expect(aveniaSetupState(undefined)).toBe('verify')
    })
})

describe('aveniaDepositPhase', () => {
    const status = (s: string, ticketStatus: string | null) => ({
        intentId: 'i',
        status: s,
        ticketStatus,
        expiresAt: null,
    })

    it('waits on an unpaid ticket', () => {
        expect(aveniaDepositPhase(undefined)).toBe('pending')
        expect(aveniaDepositPhase(status('AWAITING_USER_ACTION', 'UNPAID'))).toBe('pending')
    })

    it('is processing once the Pix reached Avenia, until the bridge completes the deposit', () => {
        for (const ticket of ['PROCESSING', 'ON-HOLD', 'PAID', 'PARTIAL-FAILED']) {
            expect(aveniaDepositPhase(status('PROCESSING', ticket))).toBe('processing')
        }
        expect(aveniaDepositPhase(status('COMPLETED', 'PAID'))).toBe('completed')
    })

    it('reads a failed or cancelled deposit as returned to the payer', () => {
        expect(aveniaDepositPhase(status('FAILED', 'FAILED'))).toBe('returned')
        expect(aveniaDepositPhase(status('CANCELLED', 'CANCELED'))).toBe('returned')
    })
})

describe('countdownLabel', () => {
    it('shows minutes and padded seconds, and nothing once time is up', () => {
        expect(countdownLabel(9 * 60_000 + 5_000)).toBe('9:05')
        expect(countdownLabel(59_999)).toBe('0:59')
        expect(countdownLabel(0)).toBeNull()
        expect(countdownLabel(-1)).toBeNull()
    })
})

describe('completePixKey', () => {
    it('normalizes a complete key to the form the Pix directory holds', () => {
        expect(completePixKey('095.799.271-89')).toBe('09579927189')
        expect(completePixKey('+55 11 98765 4321')).toBe('+5511987654321')
        expect(completePixKey('ana@example.com')).toBe('ana@example.com')
        expect(completePixKey('123e4567-e89b-12d3-a456-426614174000')).toBe('123e4567-e89b-12d3-a456-426614174000')
    })

    it('never sends an incomplete key or a Pix code to the lookup', () => {
        expect(completePixKey('095.799')).toBeNull()
        expect(completePixKey('ana@')).toBeNull()
        expect(completePixKey('')).toBeNull()
        expect(completePixKey(DEMO_AVENIA_BR_CODE)).toBeNull()
    })
})

describe('pixKeyVerdict', () => {
    const info = (ownAccount: boolean, blocked: boolean) => ({
        holderName: 'Ana',
        holderTaxIdMasked: null,
        bankName: null,
        ispb: null,
        ownAccount,
        blocked,
    })

    it('allows only the own account at a bank Avenia pays', () => {
        expect(pixKeyVerdict(info(true, false))).toBe('own')
        expect(pixKeyVerdict(info(false, false))).toBe('not-own')
        expect(pixKeyVerdict(info(true, true))).toBe('blocked')
    })
})

describe('aveniaWithdrawAmount', () => {
    it('sends reais when the user typed reais, else USD, never both', () => {
        expect(aveniaWithdrawAmount({ amountUsd: '92.5', amountBrl: '503' })).toEqual({ amountBrl: '503' })
        expect(aveniaWithdrawAmount({ amountUsd: '92.5', amountBrl: '' })).toEqual({ amountUsd: '92.5' })
        expect(aveniaWithdrawAmount({ amountUsd: '', amountBrl: '' })).toBeNull()
        expect(aveniaWithdrawAmount({ amountUsd: '0', amountBrl: '0.00' })).toBeNull()
    })
})

describe('toApiDecimal', () => {
    it("cuts to the API's places and drops trailing zeros", () => {
        expect(toApiDecimal('100', 2)).toBe('100')
        expect(toApiDecimal('100.50', 2)).toBe('100.5')
        expect(toApiDecimal('100.129', 2)).toBe('100.12')
        expect(toApiDecimal('0020.1', 2)).toBe('20.1')
        expect(toApiDecimal('1.2345678', 6)).toBe('1.234567')
    })

    it('refuses what is not a positive decimal', () => {
        expect(toApiDecimal('', 2)).toBeNull()
        expect(toApiDecimal('abc', 2)).toBeNull()
        expect(toApiDecimal('-5', 2)).toBeNull()
        expect(toApiDecimal('0.001', 2)).toBeNull()
    })
})

describe('maskedTaxIdKind', () => {
    it('tells a CPF from a CNPJ by the masked positions', () => {
        expect(maskedTaxIdKind('***.456.789-**')).toBe('CPF')
        expect(maskedTaxIdKind('12.***.***/0001-**')).toBe('CNPJ')
    })
})

describe('aveniaWithdrawRefusalKey', () => {
    it('names each refusal the preview and the init can send, and nothing else', () => {
        expect(aveniaWithdrawRefusalKey('AVENIA_LIMIT_EXCEEDED')).toBe('withdraw.errors.limitExceeded')
        expect(aveniaWithdrawRefusalKey('WITHDRAWAL_IN_PROGRESS')).toBe('withdraw.errors.inProgress')
        expect(aveniaWithdrawRefusalKey('AVENIA_TICKET_WINDOW_SHORT')).toBe('withdraw.errors.quoteExpired')
        expect(aveniaWithdrawRefusalKey('PIX_KEY_NOT_OWN')).toBe('withdraw.keyNotOwn')
        expect(aveniaWithdrawRefusalKey('PIX_KEY_BLOCKED')).toBe('withdraw.keyBlocked')
        expect(aveniaWithdrawRefusalKey('PROVIDER_REJECTED')).toBe('providerRejected')
        expect(aveniaWithdrawRefusalKey('PROVIDER_UNAVAILABLE')).toBe('unavailable')
        expect(aveniaWithdrawRefusalKey(undefined)).toBe('unavailable')
    })
})

describe('quoteMovedAgainstUser', () => {
    const reviewed = { withdrawUsd: '92.504310', amountBrl: '503.00' }

    it('lets a move within 0.1% through and flags more USD out or fewer reais in beyond it', () => {
        expect(quoteMovedAgainstUser(reviewed, reviewed)).toBe(false)
        expect(quoteMovedAgainstUser(reviewed, { withdrawUsd: '92.596000', amountBrl: '503.00' })).toBe(false)
        expect(quoteMovedAgainstUser(reviewed, { withdrawUsd: '92.600000', amountBrl: '503.00' })).toBe(true)
        expect(quoteMovedAgainstUser(reviewed, { withdrawUsd: '92.504310', amountBrl: '502.50' })).toBe(false)
        expect(quoteMovedAgainstUser(reviewed, { withdrawUsd: '92.504310', amountBrl: '502.49' })).toBe(true)
        expect(quoteMovedAgainstUser(reviewed, { withdrawUsd: '92.4', amountBrl: '503.5' })).toBe(false)
    })

    it('counts an amount it cannot read as moved', () => {
        expect(quoteMovedAgainstUser(reviewed, { withdrawUsd: 'n/a', amountBrl: '503' })).toBe(true)
    })
})
