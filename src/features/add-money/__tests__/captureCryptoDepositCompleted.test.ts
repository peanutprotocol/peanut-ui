import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { captureCryptoDepositCompleted, forgetCryptoDepositsAt } from '../captureCryptoDepositCompleted'

const mockCapture = jest.fn()
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: (...args: unknown[]) => mockCapture(...args) },
}))

const sent = () => mockCapture.mock.calls.filter(([event]) => event === ANALYTICS_EVENTS.DEPOSIT_COMPLETED).length

beforeEach(() => {
    mockCapture.mockClear()
    localStorage.clear()
})

describe('deposit_completed, once per deposit', () => {
    it('sends a deposit with a transaction once, however often its outcome is read', () => {
        const deposit = { address: '0xABC', txHash: '0xT1' }
        captureCryptoDepositCompleted(5, 'EVM', null, deposit)
        captureCryptoDepositCompleted(5, 'EVM', null, { address: '0xabc', txHash: '0xt1' })
        expect(sent()).toBe(1)
        captureCryptoDepositCompleted(5, 'EVM', null, { address: '0xabc', txHash: '0xT2' })
        expect(sent()).toBe(2)
    })

    it('counts a repeat deposit of the same amount with no transaction once the status was cleared', () => {
        captureCryptoDepositCompleted(4, 'TRON', null, { address: 'Taddr' })
        captureCryptoDepositCompleted(4, 'TRON', null, { address: 'Taddr' })
        expect(sent()).toBe(1)
        forgetCryptoDepositsAt('Taddr')
        captureCryptoDepositCompleted(4, 'TRON', null, { address: 'Taddr' })
        expect(sent()).toBe(2)
    })

    it('keeps deposits with a transaction when the status is cleared', () => {
        captureCryptoDepositCompleted(5, 'EVM', null, { address: '0xabc', txHash: '0xt1' })
        forgetCryptoDepositsAt('0xabc')
        captureCryptoDepositCompleted(5, 'EVM', null, { address: '0xabc', txHash: '0xt1' })
        expect(sent()).toBe(1)
    })
})
