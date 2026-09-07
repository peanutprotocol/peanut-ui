import { recoverLoginSession } from '../login-session'

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

it('recovers transient hydration failures without repeating the ceremony', async () => {
    const user = { userId: 'verified' }
    const load = jest
        .fn()
        .mockRejectedValueOnce(new TypeError('Failed to fetch'))
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(user)
    const cancel = jest.fn()
    const result = recoverLoginSession(load, cancel)
    await jest.advanceTimersByTimeAsync(2000)
    expect(await result).toBe(user)
    expect(load).toHaveBeenCalledTimes(3)
    expect(cancel).not.toHaveBeenCalled()
})
it('stops after three failed reads and preserves the failure cause', async () => {
    const error = new Error('database unavailable')
    const load = jest.fn().mockRejectedValue(error)
    const pending = expect(recoverLoginSession(load, jest.fn())).rejects.toMatchObject({
        name: 'PasskeyServerError',
        cause: error,
    })
    await jest.advanceTimersByTimeAsync(2000)
    await pending
    expect(load).toHaveBeenCalledTimes(3)
})
it('bounds a never-settling read and cancels it', async () => {
    const cancel = jest.fn().mockResolvedValue(undefined)
    const load = jest.fn(() => new Promise<never>(() => {}))
    const pending = expect(recoverLoginSession(load, cancel)).rejects.toMatchObject({ name: 'PasskeyServerError' })
    await jest.advanceTimersByTimeAsync(15000)
    await pending
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(load).toHaveBeenCalledTimes(1)
})
