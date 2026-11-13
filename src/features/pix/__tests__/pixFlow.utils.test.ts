import {
    pixDepositPhase,
    pixPendingReason,
    pixWithdrawAmount,
    pixShownRate,
    pixWithdrawOutcome,
    pixWithdrawRefusalKey,
    quoteMovedAgainstUser,
    signMatchesDisplay,
    completePixKey,
    maskedTaxIdKind,
    pixKeyVerdict,
    toApiDecimal,
} from '../pixFlow.utils'
import { pixRouteStep, pixSetupState } from '../pixRouteStep'
import { DEMO_PIX_BR_CODE } from '@/constants/demo-data'
import type { HistoryIntentStatus } from '@/utils/history.utils'
import type { CapabilityRoute, NextAction, NextActionKind } from '@/types/capabilities'

const route = (
    state: CapabilityRoute['state'],
    extra: Partial<Pick<CapabilityRoute, 'action'>> = {}
): Pick<CapabilityRoute, 'state' | 'action'> => ({ state, ...extra })

describe('pixSetupState', () => {
    it("reads the user's step from the backend's route and its next action", () => {
        expect(pixSetupState(route('ready'), undefined)).toBe('ready')
        expect(pixSetupState(route('pending'), undefined)).toBe('pending')
        expect(pixSetupState(route('action_required', { action: 'verify' }), undefined)).toBe('verify')
        expect(pixSetupState(route('action_required', { action: 'activate' }), undefined)).toBe('activate')
    })

    it('leaves any other step to support', () => {
        expect(
            pixSetupState(route('action_required', { action: 'contact-support:x' }), { kind: 'contact-support' })
        ).toBe('support')
        expect(pixSetupState(route('action_required', { action: 'card' }), { kind: 'rain-hosted' })).toBe('support')
        expect(pixSetupState(route('action_required', { action: 'unknown-step' }), undefined)).toBe('support')
        expect(pixSetupState(undefined, undefined)).toBe('support')
    })

    // TASK-24910: a provider's rail can ask, as a Pix route's step, for what it asks on the bank rails
    it("hands the steps the bank rails' screens run to them, by the action's kind", () => {
        const step = (kind: NextActionKind) => pixSetupState(route('action_required', { action: kind }), { kind })
        expect(step('sumsub')).toBe('rail-step')
        expect(step('bridge-hosted')).toBe('rail-step')
        expect(step('provide-email')).toBe('rail-step')
        expect(step('restart-identity')).toBe('rail-step')
        expect(step('questions')).toBe('rail-step')
        expect(step('hosted-identity')).toBe('hosted-verify')
    })

    // both are `accept-tos`: the route's own terms name their document, the bank rails' terms come from their link
    it('tells the terms the Pix setup records from the terms the bank rails open, by the document the action names', () => {
        const terms = route('action_required', { action: 'accept-tos:x' })
        expect(pixSetupState(terms, { kind: 'accept-tos', tosUrl: 'https://example.com/terms' })).toBe('accept-terms')
        expect(pixSetupState(route('action_required', { action: 'accept-tos' }), { kind: 'accept-tos' })).toBe(
            'rail-step'
        )
    })
})

describe('pixRouteStep', () => {
    it('reads the next action the route names', () => {
        const nextActions: NextAction[] = [
            { key: 'accept-tos', kind: 'accept-tos', purpose: 'accept-bridge-tos' },
            { key: 'sumsub:tax_identification_number', kind: 'sumsub', purpose: 'unlock-bridge' },
        ]
        expect(
            pixRouteStep(route('action_required', { action: 'sumsub:tax_identification_number' }), nextActions)
        ).toBe('rail-step')
        // a key the capabilities do not list names no step the app can run
        expect(pixRouteStep(route('action_required', { action: 'bridge-hosted' }), nextActions)).toBe('support')
    })
})

describe('pixPendingReason', () => {
    it('names why the route waits', () => {
        expect(pixPendingReason('provider_reviewing')).toBe('reviewing')
        expect(pixPendingReason(undefined)).toBe('reviewing')
    })
})

describe('pixDepositPhase', () => {
    const status = (s: string, pixReceived: boolean) => ({
        provider: 'manteca',
        intentId: 'i',
        status: s,
        pixReceived,
        expiresAt: null,
        amountBrl: '100.00',
        usdcAmount: '17.94',
        codePayable: s === 'AWAITING_USER_ACTION' && !pixReceived,
    })

    it('waits on an unpaid code', () => {
        expect(pixDepositPhase(undefined)).toBe('pending')
        expect(pixDepositPhase(status('AWAITING_USER_ACTION', false))).toBe('pending')
    })

    it('is processing once the provider received the Pix, until the USDC completes the deposit', () => {
        expect(pixDepositPhase(status('AWAITING_USER_ACTION', true))).toBe('processing')
        expect(pixDepositPhase(status('PROCESSING', true))).toBe('processing')
        expect(pixDepositPhase(status('COMPLETED', true))).toBe('completed')
    })

    it('reads a failed deposit as returned to the payer', () => {
        expect(pixDepositPhase(status('FAILED', true))).toBe('returned')
        expect(pixDepositPhase(status('REFUNDED', true))).toBe('returned')
    })

    it('reads a code cancelled after its expiry as expired, not returned: nothing was paid', () => {
        expect(pixDepositPhase(status('CANCELLED', false))).toBe('expired')
    })

    it('reads an unpaid code the API no longer calls payable as expired, before the poller cancels it', () => {
        expect(pixDepositPhase({ ...status('AWAITING_USER_ACTION', false), codePayable: false })).toBe('expired')
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
        expect(completePixKey(DEMO_PIX_BR_CODE)).toBeNull()
    })
})

describe('pixKeyVerdict', () => {
    it('leaves the holder unchecked when the provider cannot tell', () => {
        expect(
            pixKeyVerdict({
                provider: 'manteca',
                holderName: 'Ana',
                holderTaxIdMasked: null,
                bankName: null,
                ispb: null,
                ownAccount: null,
                blocked: false,
            })
        ).toBe('unchecked')
    })
})

describe('pixWithdrawAmount', () => {
    const none = { amountUsd: '', amountBrl: '', spendUsd: '' }

    it('sends reais when the user typed reais, else USD, never both', () => {
        expect(pixWithdrawAmount({ ...none, amountUsd: '92.5', amountBrl: '503' })).toEqual({ amountBrl: '503' })
        expect(pixWithdrawAmount({ ...none, amountUsd: '92.5' })).toEqual({ amountUsd: '92.5' })
        expect(pixWithdrawAmount(none)).toBeNull()
        expect(pixWithdrawAmount({ ...none, amountUsd: '0', amountBrl: '0.00' })).toBeNull()
    })

    it('sends the balance as what leaves the wallet when the user tapped it', () => {
        expect(pixWithdrawAmount({ ...none, spendUsd: '120.123456' })).toEqual({ spendUsd: '120.123456' })
        expect(pixWithdrawAmount({ ...none, spendUsd: '120.1234567' })).toEqual({ spendUsd: '120.123456' })
        expect(pixWithdrawAmount({ ...none, spendUsd: '0' })).toBeNull()
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

describe('pixWithdrawRefusalKey', () => {
    it('names each refusal the preview and the init can send, and nothing else', () => {
        expect(pixWithdrawRefusalKey('PIX_LIMIT_EXCEEDED')).toBe('withdraw.errors.limitExceeded')
        expect(pixWithdrawRefusalKey('WITHDRAWAL_IN_PROGRESS')).toBe('withdraw.errors.inProgress')
        expect(pixWithdrawRefusalKey('PIX_QUOTE_EXPIRED')).toBe('withdraw.errors.quoteExpired')
        expect(pixWithdrawRefusalKey('PIX_KEY_NOT_OWN')).toBe('withdraw.keyNotOwn')
        expect(pixWithdrawRefusalKey('PIX_KEY_BLOCKED')).toBe('withdraw.keyBlocked')
        expect(pixWithdrawRefusalKey('PIX_KEY_NOT_FOUND')).toBe('pixKeyNotFound')
        expect(pixWithdrawRefusalKey('PIX_QUOTE_CHANGED')).toBe('withdraw.errors.quoteChanged')
        expect(pixWithdrawRefusalKey('PIX_MIN_AMOUNT')).toBe('minimum')
        expect(pixWithdrawRefusalKey('PROVIDER_REJECTED')).toBe('providerRejected')
        expect(pixWithdrawRefusalKey('PROVIDER_UNAVAILABLE')).toBe('unavailable')
        expect(pixWithdrawRefusalKey(undefined)).toBe('unavailable')
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

describe('pixWithdrawOutcome', () => {
    const entry = (status: string) => ({
        status: status as never,
        extraData: { kind: 'OFFRAMP', provider: 'MANTECA', pixRecovery: null },
    })

    it('says "on its way" after the signature until the provider pays the Pix', () => {
        expect(pixWithdrawOutcome('funded', undefined)).toBe('on-its-way')
        expect(pixWithdrawOutcome('funded', entry('PENDING'))).toBe('on-its-way')
        expect(pixWithdrawOutcome('funded', entry('COMPLETED'))).toBe('arrived')
    })

    it('says when the money came back', () => {
        expect(pixWithdrawOutcome('funded', entry('REFUNDED'))).toBe('refunded')
    })

    it('after a reload, calls a withdrawal this device never signed not sent while the API waits for it', () => {
        const waiting = (intentStatus: HistoryIntentStatus) => ({
            status: 'PENDING' as never,
            extraData: { intentStatus },
        })
        expect(pixWithdrawOutcome('unsigned', waiting('AWAITING_USER_ACTION'))).toBe('not-sent')
        // the device may have sent it: wait for the API instead
        expect(pixWithdrawOutcome('unconfirmed', waiting('AWAITING_USER_ACTION'))).toBe('unconfirmed')
        // the API saw the deposit
        expect(pixWithdrawOutcome('unsigned', waiting('PROCESSING'))).toBe('on-its-way')
        expect(pixWithdrawOutcome('unconfirmed', waiting('PROCESSING'))).toBe('on-its-way')
    })

    it('calls an unconfirmed deposit not sent only once the entry ends unfunded', () => {
        expect(pixWithdrawOutcome('unconfirmed', undefined)).toBe('unconfirmed')
        expect(pixWithdrawOutcome('unconfirmed', entry('CANCELLED'))).toBe('not-sent')
        expect(pixWithdrawOutcome('unconfirmed', entry('COMPLETED'))).toBe('arrived')
        // a mined deposit never reads as not sent: its money moved
        expect(pixWithdrawOutcome('funded', entry('FAILED'))).toBe('stuck')
    })

    it('never reads an ended withdrawal as on its way', () => {
        for (const status of ['FAILED', 'CANCELLED', 'SOMETHING_NEW']) {
            expect(pixWithdrawOutcome('funded', entry(status))).toBe('stuck')
        }
        expect(pixWithdrawOutcome('unconfirmed', entry('SOMETHING_NEW'))).toBe('stuck')
    })
})

describe('pixShownRate', () => {
    // USD × rate − fee = reais holds over the API's exact USD (the /pix/withdraw display contract)
    const display = (withdrawUsd: string, amountBrl: string) => {
        const rate = ((Number(amountBrl) + 0.75) / Number(withdrawUsd)).toFixed(6)
        return { withdrawUsd, amountBrl, fixedFeeBrl: '0.75', rate }
    }

    it.each([
        ['92.504310', '503.00'],
        ['3.552113', '20.00'],
        ['9183.774512', '50000.00'],
        ['1.004999', '4.71'],
    ])('makes the shown USD, rate and fee agree to the centavo (%s USD)', (usd, brl) => {
        const shownUsd = Math.round(Number(usd) * 100) / 100
        const shownRate = Number(pixShownRate(display(usd, brl)))
        expect(Math.abs(shownUsd * shownRate - 0.75 - Number(brl))).toBeLessThan(0.005)
    })
})
