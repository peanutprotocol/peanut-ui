import {
    aveniaDepositPhase,
    aveniaPendingReason,
    aveniaSetupState,
    aveniaWithdrawAmount,
    aveniaWithdrawOutcome,
    aveniaWithdrawRefusalKey,
    quoteMovedAgainstUser,
    signMatchesDisplay,
    completePixKey,
    maskedTaxIdKind,
    pixKeyVerdict,
    toApiDecimal,
} from '../avenia.utils'
import { awaitsNewPixKey, aveniaNewKeyUrl } from '../aveniaRecovery'
import { DEMO_AVENIA_BR_CODE } from '@/constants/demo-data'
import type { CapabilityRoute } from '@/types/capabilities'

const route = (
    state: CapabilityRoute['state'],
    extra: Partial<Pick<CapabilityRoute, 'action'>> = {}
): Pick<CapabilityRoute, 'state' | 'action'> => ({ state, ...extra })

describe('aveniaSetupState', () => {
    it("reads the user's step from the backend's route and its next action", () => {
        expect(aveniaSetupState(route('ready'), undefined)).toBe('ready')
        expect(aveniaSetupState(route('pending'), undefined)).toBe('pending')
        expect(aveniaSetupState(route('action_required', { action: 'verify' }), undefined)).toBe('verify')
        expect(aveniaSetupState(route('action_required', { action: 'accept-tos:avenia' }), 'accept-tos')).toBe(
            'accept-terms'
        )
    })

    it('leaves any other step to support', () => {
        expect(aveniaSetupState(route('action_required', { action: 'contact-support:x' }), 'contact-support')).toBe(
            'support'
        )
        expect(aveniaSetupState(route('action_required', { action: 'accept-tos:avenia' }), undefined)).toBe('support')
        expect(aveniaSetupState(undefined, undefined)).toBe('support')
    })
})

describe('aveniaPendingReason', () => {
    it('names why the route waits', () => {
        expect(aveniaPendingReason('provider_reviewing')).toBe('reviewing')
        expect(aveniaPendingReason('avenia_import_unavailable')).toBe('import-unavailable')
        expect(aveniaPendingReason('avenia_cpf_missing')).toBe('cpf-missing')
        expect(aveniaPendingReason(undefined)).toBe('reviewing')
    })
})

describe('aveniaDepositPhase', () => {
    const status = (s: string, ticketStatus: string | null) => ({
        intentId: 'i',
        status: s,
        ticketStatus,
        expiresAt: null,
        amountBrl: '100.00',
        usdcAmount: '17.94',
        codePayable: s === 'AWAITING_USER_ACTION' && ticketStatus === 'UNPAID',
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

    it('reads a failed deposit as returned to the payer', () => {
        expect(aveniaDepositPhase(status('FAILED', 'FAILED'))).toBe('returned')
        expect(aveniaDepositPhase(status('REFUNDED', 'FAILED'))).toBe('returned')
    })

    it('reads a code the API cancelled after its expiry as expired, not returned: nothing was paid', () => {
        expect(aveniaDepositPhase(status('CANCELLED', 'CANCELED'))).toBe('expired')
        expect(aveniaDepositPhase(status('CANCELLED', 'UNPAID'))).toBe('expired')
    })

    it('reads an unpaid code the API no longer calls payable as expired, before the poller cancels it', () => {
        expect(aveniaDepositPhase({ ...status('AWAITING_USER_ACTION', 'UNPAID'), codePayable: false })).toBe('expired')
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
    const none = { amountUsd: '', amountBrl: '', spendUsd: '' }

    it('sends reais when the user typed reais, else USD, never both', () => {
        expect(aveniaWithdrawAmount({ ...none, amountUsd: '92.5', amountBrl: '503' })).toEqual({ amountBrl: '503' })
        expect(aveniaWithdrawAmount({ ...none, amountUsd: '92.5' })).toEqual({ amountUsd: '92.5' })
        expect(aveniaWithdrawAmount(none)).toBeNull()
        expect(aveniaWithdrawAmount({ ...none, amountUsd: '0', amountBrl: '0.00' })).toBeNull()
    })

    it('sends the balance as what leaves the wallet when the user tapped it', () => {
        expect(aveniaWithdrawAmount({ ...none, spendUsd: '120.123456' })).toEqual({ spendUsd: '120.123456' })
        expect(aveniaWithdrawAmount({ ...none, spendUsd: '120.1234567' })).toEqual({ spendUsd: '120.123456' })
        expect(aveniaWithdrawAmount({ ...none, spendUsd: '0' })).toBeNull()
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
        expect(aveniaWithdrawRefusalKey('PIX_LIMIT_EXCEEDED')).toBe('withdraw.errors.limitExceeded')
        expect(aveniaWithdrawRefusalKey('WITHDRAWAL_IN_PROGRESS')).toBe('withdraw.errors.inProgress')
        expect(aveniaWithdrawRefusalKey('PIX_QUOTE_EXPIRED')).toBe('withdraw.errors.quoteExpired')
        expect(aveniaWithdrawRefusalKey('PIX_KEY_NOT_OWN')).toBe('withdraw.keyNotOwn')
        expect(aveniaWithdrawRefusalKey('PIX_KEY_BLOCKED')).toBe('withdraw.keyBlocked')
        expect(aveniaWithdrawRefusalKey('PIX_KEY_NOT_FOUND')).toBe('pixKeyNotFound')
        expect(aveniaWithdrawRefusalKey('PIX_QUOTE_CHANGED')).toBe('withdraw.errors.quoteChanged')
        expect(aveniaWithdrawRefusalKey('PIX_MIN_AMOUNT')).toBe('minimum')
        expect(aveniaWithdrawRefusalKey('PROVIDER_REJECTED')).toBe('providerRejected')
        expect(aveniaWithdrawRefusalKey('PROVIDER_UNAVAILABLE')).toBe('unavailable')
        expect(aveniaWithdrawRefusalKey(undefined)).toBe('unavailable')
    })
})

describe('quoteMovedAgainstUser', () => {
    const reviewed = { withdrawUsd: '92.504310', amountBrl: '503.00' }

    it('flags any move to more USD out or fewer reais in, and nothing else', () => {
        expect(quoteMovedAgainstUser(reviewed, reviewed)).toBe(false)
        expect(quoteMovedAgainstUser(reviewed, { withdrawUsd: '92.504311', amountBrl: '503.00' })).toBe(true)
        expect(quoteMovedAgainstUser(reviewed, { withdrawUsd: '92.504310', amountBrl: '502.99' })).toBe(true)
        expect(quoteMovedAgainstUser(reviewed, { withdrawUsd: '92.4', amountBrl: '503.5' })).toBe(false)
    })

    it('counts an amount it cannot read as moved', () => {
        expect(quoteMovedAgainstUser(reviewed, { withdrawUsd: 'n/a', amountBrl: '503' })).toBe(true)
    })
})

describe('signMatchesDisplay', () => {
    it('binds the signed amount to the USD the user is shown', () => {
        const display = { withdrawUsd: '92.504310' }
        expect(signMatchesDisplay(display, { payAmount: '92.50431', payAmountUnits: '92504310' })).toBe(true)
        expect(signMatchesDisplay(display, { payAmount: '92.50431', payAmountUnits: '92504311' })).toBe(false)
        expect(signMatchesDisplay(display, { payAmount: '95', payAmountUnits: '92504310' })).toBe(false)
        expect(signMatchesDisplay(display, { payAmount: 'x', payAmountUnits: 'y' })).toBe(false)
    })
})

describe('awaitsNewPixKey', () => {
    // the extraData of GET /history/:entryId for an Avenia withdrawal, as PR B sends it
    const recovery = (state: 'awaiting-key' | 'in-progress' | 'done') => ({
        kind: 'OFFRAMP',
        provider: 'AVENIA',
        aveniaRecovery: { state, reason: 'payout-failed' as const, failureCode: 'RECEIVER_PIX_KEY_INVALID' },
    })

    it('reads the recovery state of the history entry', () => {
        expect(awaitsNewPixKey(recovery('awaiting-key'))).toBe(true)
        expect(awaitsNewPixKey(recovery('in-progress'))).toBe(false)
        expect(awaitsNewPixKey(recovery('done'))).toBe(false)
        expect(awaitsNewPixKey({ kind: 'OFFRAMP', provider: 'AVENIA', aveniaRecovery: null })).toBe(false)
        expect(awaitsNewPixKey(undefined)).toBe(false)
    })

    it('opens the new-key screen with the withdrawal in the URL', () => {
        expect(aveniaNewKeyUrl('0b9e3c1d-7a2f')).toBe('/withdraw/new-pix-key?intentId=0b9e3c1d-7a2f')
    })
})

describe('aveniaWithdrawOutcome', () => {
    const entry = (status: string, state?: 'awaiting-key' | 'in-progress' | 'done') => ({
        status: status as never,
        extraData: {
            kind: 'OFFRAMP',
            provider: 'AVENIA',
            aveniaRecovery: state
                ? { state, reason: 'payout-failed' as const, failureCode: 'RECEIVER_ACCOUNT_CLOSED' }
                : null,
        },
    })

    it('says "on its way" after the funding deposit until Avenia pays the Pix', () => {
        expect(aveniaWithdrawOutcome('funded', undefined)).toBe('on-its-way')
        expect(aveniaWithdrawOutcome('funded', entry('PENDING'))).toBe('on-its-way')
        expect(aveniaWithdrawOutcome('funded', entry('COMPLETED'))).toBe('arrived')
    })

    it('asks for another key when the bank refused the payout, and says when the money came back', () => {
        expect(aveniaWithdrawOutcome('funded', entry('PENDING', 'awaiting-key'))).toBe('needs-key')
        expect(aveniaWithdrawOutcome('funded', entry('PENDING', 'in-progress'))).toBe('on-its-way')
        expect(aveniaWithdrawOutcome('funded', entry('REFUNDED', 'done'))).toBe('refunded')
    })

    it('calls an unconfirmed deposit not sent only once the entry ends unfunded', () => {
        expect(aveniaWithdrawOutcome('unconfirmed', undefined)).toBe('unconfirmed')
        expect(aveniaWithdrawOutcome('unconfirmed', entry('CANCELLED'))).toBe('not-sent')
        expect(aveniaWithdrawOutcome('unconfirmed', entry('COMPLETED'))).toBe('arrived')
        // a mined deposit never reads as not sent: its money moved
        expect(aveniaWithdrawOutcome('funded', entry('FAILED'))).toBe('on-its-way')
    })
})
