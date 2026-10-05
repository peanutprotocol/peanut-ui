import { unstable_cache } from '../no-cache'

test('concurrent consumers share one provider request and then its cached result', async () => {
    let resolve!: (value: number) => void
    const provider = jest.fn(
        () =>
            new Promise<number>((done) => {
                resolve = done
            })
    )
    const read = unstable_cache(provider, ['concurrent-provider-test'])
    const first = read()
    const second = read()
    await Promise.resolve()
    expect(provider).toHaveBeenCalledTimes(1)
    resolve(1.2)
    expect(await Promise.all([first, second])).toEqual([1.2, 1.2])
    expect(await read()).toBe(1.2)
    expect(provider).toHaveBeenCalledTimes(1)
})

test('a shared failure is not cached and the next request can recover', async () => {
    const provider = jest.fn().mockRejectedValueOnce(new Error('provider unavailable')).mockResolvedValueOnce(1.3)
    const read = unstable_cache(provider, ['provider-recovery-test'])
    const results = await Promise.allSettled([read(), read()])
    expect(results.every((result) => result.status === 'rejected')).toBe(true)
    expect(provider).toHaveBeenCalledTimes(1)
    expect(await read()).toBe(1.3)
})

test('different currency arguments keep independent requests and cache entries', async () => {
    const provider = jest.fn(async (currency: string) => currency)
    const read = unstable_cache(provider, ['independent-currency-test'])
    expect(await Promise.all([read('EUR'), read('GBP')])).toEqual(['EUR', 'GBP'])
    expect(provider).toHaveBeenCalledTimes(2)
})
