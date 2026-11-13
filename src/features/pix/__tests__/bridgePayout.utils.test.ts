import { ApiError } from '@/services/api-error'
import {
    pixPayoutShown,
    pixRefusalMinimum,
    pixWithdrawOutcome,
    pixWithdrawRefusalKey,
    quoteNeedsReview,
} from '../pixFlow.utils'
import { pixKeySend } from '../pixRoute.utils'
import { withdrawSubmitReducer, canSignOpened, type WithdrawSubmitState } from '../pixWithdrawSubmitReducer'
import type { PixWithdrawDisplay, PixWithdrawSign } from '@/services/pix'

/**
 * Pix payouts through Bridge (API-CONTRACT.md section 6): any key, own or another person's; the
 * reais an estimate (no rate lock); the withdrawal named at the open; Bridge's transfer states in
 * the history entry.
 */
const display: PixWithdrawDisplay = {
    amountBrl: '100.00',
    pixKey: '11144477735',
    ownAccount: false,
    holderName: 'BRUNO LIMA',
    bankName: 'Nu Pagamentos S.A.',
    withdrawUsd: '18.87',
    rate: '5.30',
    fixedFeeBrl: '0',
    arrivalEstimateSeconds: 300,
    provider: 'Bridge',
    amountBrlEstimated: true,
}

describe('pixKeySend: how Send pays a Pix key', () => {
    it('goes through the withdraw route for a resident whose pay route refuses the residence', () => {
        expect(pixKeySend('residence', { state: 'ready' })).toEqual({ via: 'withdraw', block: null })
        // a withdraw route still being set up opens its setup on the Pix-key page
        expect(pixKeySend('residence', { state: 'action_required' })).toEqual({ via: 'withdraw', block: null })
    })

    it("keeps the pay route's block where no withdraw route serves the resident", () => {
        expect(pixKeySend('residence', { state: 'refused' })).toEqual({ via: 'pay', block: 'residence' })
        expect(pixKeySend('residence', undefined)).toEqual({ via: 'pay', block: 'residence' })
    })

    it('leaves the Brazil pause and every user the pay route serves as they were', () => {
        expect(pixKeySend('paused', { state: 'paused' })).toEqual({ via: 'pay', block: 'paused' })
        expect(pixKeySend(null, { state: 'ready' })).toEqual({ via: 'pay', block: null })
    })
})

describe('quoteNeedsReview: the open read the rate again', () => {
    it('shows any change of an estimate before the signature, even one in the user’s favour', () => {
        expect(quoteNeedsReview(display, { ...display, amountBrl: '100.40' })).toBe(true)
        expect(quoteNeedsReview(display, { ...display, withdrawUsd: '18.86' })).toBe(true)
        // a fee on Bridge's receipt: its own line, and fewer reais
        expect(quoteNeedsReview(display, { ...display, amountBrl: '97.88', fixedFeeBrl: '2.12' })).toBe(true)
        expect(quoteNeedsReview(display, { ...display })).toBe(false)
    })

    it('keeps the locked quote’s rule: only a move against the user', () => {
        const locked = { ...display, amountBrlEstimated: undefined }
        expect(quoteNeedsReview(locked, { ...locked, amountBrl: '100.40' })).toBe(false)
        expect(quoteNeedsReview(locked, { ...locked, amountBrl: '99.90' })).toBe(true)
    })
})

describe('pixPayoutShown', () => {
    it('marks the reais of a quote the provider does not lock as approximate', () => {
        expect(pixPayoutShown(display)).toBe('≈ R$100')
        expect(pixPayoutShown({ ...display, amountBrlEstimated: undefined })).toBe('R$100')
    })
})

describe('pixRefusalMinimum: the figure Bridge states, never a constant', () => {
    const minimum = (message: string) => new ApiError(message, { status: 400, code: 'PIX_MIN_AMOUNT' })

    it('reads the reais or the USDC the refusal names', () => {
        expect(pixRefusalMinimum(minimum('The minimum Pix withdrawal is R$20.'))).toEqual({
            amount: '20',
            currency: 'BRL',
        })
        expect(pixRefusalMinimum(minimum('The minimum Pix withdrawal is 2 USDC.'))).toEqual({
            amount: '2',
            currency: 'USD',
        })
    })

    it('names nothing for a refusal without a figure, or another refusal', () => {
        expect(pixRefusalMinimum(minimum('Too small.'))).toBeNull()
        expect(pixRefusalMinimum(new ApiError('R$20', { status: 400, code: 'PIX_LIMIT_EXCEEDED' }))).toBeNull()
    })
})

describe('pixWithdrawRefusalKey: the payee refusals of the preview and the open', () => {
    it('names a bounced key, a key still checked and a throttled lookup', () => {
        expect(pixWithdrawRefusalKey('BANK_ACCOUNT_NOT_USABLE')).toBe('withdraw.keyNotUsable')
        expect(pixWithdrawRefusalKey('PIX_KEY_CHECK_PENDING')).toBe('withdraw.keyChecking')
        expect(pixWithdrawRefusalKey('PIX_KEY_LOOKUP_THROTTLED')).toBe('withdraw.lookupThrottled')
    })
})

describe("pixWithdrawOutcome on Bridge's transfer states", () => {
    const entry = (status: string, txHash?: string) => ({ status, extraData: { pixPayee: 'other' as const }, txHash })

    it('is paid at PAYMENT_PROCESSED, and returned at RETURNED or REFUNDED', () => {
        expect(pixWithdrawOutcome('funded', entry('PAYMENT_PROCESSED'))).toBe('arrived')
        expect(pixWithdrawOutcome('funded', entry('RETURNED'))).toBe('refunded')
        expect(pixWithdrawOutcome('funded', entry('REFUNDED'))).toBe('refunded')
    })

    it('is on its way while Bridge holds the funding, and once the funding mined', () => {
        for (const status of ['FUNDS_RECEIVED', 'PAYMENT_SUBMITTED', 'IN_REVIEW'])
            expect(pixWithdrawOutcome('unsigned', entry(status))).toBe('on-its-way')
        expect(pixWithdrawOutcome('funded', entry('AWAITING_FUNDS'))).toBe('on-its-way')
        // after a reload: the API recorded the mined funding
        expect(pixWithdrawOutcome('unsigned', entry('AWAITING_FUNDS', '0xabc'))).toBe('on-its-way')
    })

    it('never invites a new withdrawal while the funding may be on its way', () => {
        expect(pixWithdrawOutcome('unconfirmed', entry('AWAITING_FUNDS'))).toBe('unconfirmed')
    })

    it('sends a payout that failed after the funding to support, whatever this device knows', () => {
        for (const phase of ['funded', 'unconfirmed', 'unsigned'] as const) {
            expect(pixWithdrawOutcome(phase, entry('UNDELIVERABLE'))).toBe('stuck')
            expect(pixWithdrawOutcome(phase, entry('ERROR'))).toBe('stuck')
        }
    })

    it('reads a transfer Bridge cancelled before any funding as not sent', () => {
        expect(pixWithdrawOutcome('unconfirmed', entry('CANCELED'))).toBe('not-sent')
        expect(pixWithdrawOutcome('funded', entry('CANCELED'))).toBe('stuck')
    })
})

describe('withdrawSubmitReducer for a transfer the open already names (Bridge)', () => {
    const sign: PixWithdrawSign = {
        kind: 'transfer-then-submit',
        depositAddress: '0x00000000000000000000000000000000000000d3',
        tokenAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
        payAmount: '18.87',
        payAmountUnits: '18870000',
        priceLockCode: 'b1',
        quoteExpiresAt: new Date(Date.now() + 300_000).toISOString(),
    }
    const withdrawal = { intentId: 'b1', display, sign }
    const signing: WithdrawSubmitState = { phase: 'signing', withdrawal, resigned: false }

    it('can be signed again after every signature that sent nothing, while its window holds', () => {
        let state = withdrawSubmitReducer(signing, { type: 'SENT_NOTHING', error: 'dismissed' })
        expect(state).toMatchObject({ phase: 'opened', resignable: true })
        state = withdrawSubmitReducer(state, { type: 'SIGN_START', withdrawal })
        state = withdrawSubmitReducer(state, { type: 'SENT_NOTHING', error: 'dismissed again' })
        expect(canSignOpened(state)).toBe(true)
    })

    it('starts again once the window passed or the API closed it: Confirm opens a new withdrawal', () => {
        expect(withdrawSubmitReducer(signing, { type: 'SENT_NOTHING', error: 'expired', restart: true })).toEqual({
            phase: 'idle',
            error: 'expired',
        })
        const opened = withdrawSubmitReducer(signing, { type: 'SENT_NOTHING', error: 'dismissed' })
        expect(withdrawSubmitReducer(opened, { type: 'QUOTE_EXPIRED', withdrawal, error: 'expired' })).toEqual({
            phase: 'idle',
            error: 'expired',
        })
        expect(
            withdrawSubmitReducer({ phase: 'starting' }, { type: 'QUOTE_EXPIRED', withdrawal, error: 'expired' })
        ).toEqual({ phase: 'idle', error: 'expired' })
    })

    it('holds a submit whose outcome is unknown, with no signature on offer', () => {
        const state = withdrawSubmitReducer(signing, { type: 'NO_RECEIPT' })
        expect(state).toEqual({ phase: 'unconfirmed', withdrawal })
        expect(canSignOpened(state)).toBe(false)
        // nothing takes it out of there: no second signature
        expect(withdrawSubmitReducer(state, { type: 'SIGN_START', withdrawal })).toBe(state)
    })
})
