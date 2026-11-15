import { saveSignupPaymentPlan, saveSignupResidence } from '../saveSignupAnswers'
import { updateUserById } from '@/app/actions/users'

jest.mock('@/app/actions/users', () => ({ updateUserById: jest.fn() }))
jest.mock('@/utils/declared-residence.storage', () => ({
    storeDeclaredResidence: jest.fn(),
    storeSecondResidence: jest.fn(),
}))
const update = jest.mocked(updateUserById)
const flush = async () => {
    for (let i = 0; i < 12; i++) await Promise.resolve()
}

beforeEach(() => update.mockReset())

it('serializes repeated residence/nationality writes so the latest answer lands last', async () => {
    let finish!: (value: never) => void
    update
        .mockReturnValueOnce(
            new Promise((resolve) => {
                finish = resolve
            })
        )
        .mockResolvedValue({} as never)
    const oldSaved = jest.fn()
    const newSaved = jest.fn()
    saveSignupResidence('same-user', 'PT', 'BR', oldSaved)
    saveSignupResidence('same-user', 'US', 'UA', newSaved)
    await flush()
    expect(update).toHaveBeenCalledTimes(1)
    expect(newSaved).not.toHaveBeenCalled()
    finish({} as never)
    await flush()
    expect(update).toHaveBeenLastCalledWith({ userId: 'same-user', residenceCountry: 'US', nationality: 'UA' })
    expect(oldSaved).toHaveBeenCalledTimes(1)
    expect(newSaved).toHaveBeenCalledTimes(1)
})

it.each(['reject', 'error'])(
    'continues queued writes after a %s failure, with no success callback for it',
    async (kind) => {
        const log = jest.spyOn(console, 'error').mockImplementation(() => {})
        try {
            if (kind === 'reject') update.mockRejectedValueOnce(new Error('offline'))
            else update.mockResolvedValueOnce({ error: 'failed' } as never)
            update.mockResolvedValue({} as never)
            const failedSaved = jest.fn()
            saveSignupResidence(`failed-${kind}`, 'PT', 'BR', failedSaved)
            saveSignupResidence(`failed-${kind}`, 'US', 'UA')
            await flush()
            expect(update).toHaveBeenCalledTimes(2)
            expect(failedSaved).not.toHaveBeenCalled()
        } finally {
            log.mockRestore()
        }
    }
)

it('keeps separate accounts independent while serializing payment preferences with residence', async () => {
    let finish!: (value: never) => void
    update
        .mockReturnValueOnce(
            new Promise((resolve) => {
                finish = resolve
            })
        )
        .mockResolvedValue({} as never)
    saveSignupResidence('account-a', 'PT', 'BR')
    saveSignupPaymentPlan('account-a', 'bank' as never, 'card' as never)
    saveSignupResidence('account-b', 'US', 'UA')
    await flush()
    expect(update).toHaveBeenCalledTimes(2)
    expect(update).toHaveBeenLastCalledWith({ userId: 'account-b', residenceCountry: 'US', nationality: 'UA' })
    finish({} as never)
    await flush()
    expect(update).toHaveBeenLastCalledWith({
        userId: 'account-a',
        signupPreferences: { fundingChannel: 'bank', paymentChannel: 'card' },
    })
})
