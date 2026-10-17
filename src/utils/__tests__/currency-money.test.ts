import { currencyAmount } from '../currency-amount'
import {
    assertCurrencyOperationSession,
    clearSignedCurrencyOperation,
    clearUserCurrencyOperations,
    currencyOperationSession,
    guardCurrencyOperation,
    readSignedCurrencyOperation,
    storeSignedCurrencyOperation,
} from '../currency-operation-recovery'
import { mergeCurrencyHistory } from '../currency-history'
import type { CurrencyHistoryResponse } from '@/services/currency-accounts'

it('normalizes 1,000 seeded exact amounts without rounding, and rejects extra precision', () => {
    let seed = 4082
    for (let index = 0; index < 1000; index++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
        const units = seed + 1
        const value = `${Math.floor(units / 1_000_000)}.${String(units % 1_000_000).padStart(6, '0')}`
        for (const locale of ['es-419', 'es-AR', 'pt-BR']) {
            expect(currencyAmount(value.replace('.', ','), locale)).toBe(value)
            expect(currencyAmount(`${value.replace('.', ',')}1`, locale)).toBeNull()
        }
        expect(currencyAmount(value, 'en', true) !== null).toBe(units % 10_000 === 0)
    }
    for (const value of ['1e3', '1,2,3', '-1', '0', '1.0000001', '1000000000000', '1 234', '١.٢٣']) {
        expect(currencyAmount(value, 'es-419')).toBeNull()
    }
})

it('keeps identical bytes in memory when the durable write fails, and persists them on the next write', () => {
    const user = 'storage-write-test'
    const operation = { signature: '0xaaaa', nonce: '0x1' }
    const write = jest.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
        throw new Error('private mode')
    })
    expect(() => storeSignedCurrencyOperation(user, 'one', operation)).not.toThrow()
    expect(readSignedCurrencyOperation(user, 'one')).toBe(operation)
    storeSignedCurrencyOperation(user, 'one', operation)
    expect(JSON.parse(localStorage.getItem(`eurc-signed-operation:${user}:one`)!)).toEqual({ operation })
    write.mockRestore()
    clearUserCurrencyOperations(user)
})

it('reads bytes a previous page persisted, with nothing in memory', () => {
    const operation = { signature: '0xdd', nonce: '0x2' }
    localStorage.setItem('eurc-signed-operation:reload-test:one', JSON.stringify({ operation }))
    expect(readSignedCurrencyOperation('reload-test', 'one')).toEqual(operation)
    clearUserCurrencyOperations('reload-test')
    expect(localStorage.getItem('eurc-signed-operation:reload-test:one')).toBeNull()
})

it('treats unreadable or malformed recovery data as absent', () => {
    const read = jest.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => {
        throw new Error('native unavailable')
    })
    expect(readSignedCurrencyOperation('storage-read-test', 'one')).toBeNull()
    read.mockRestore()
    localStorage.setItem('eurc-signed-operation:storage-read-test:one', '{')
    expect(readSignedCurrencyOperation('storage-read-test', 'one')).toBeNull()
    clearUserCurrencyOperations('storage-read-test')
})

it('logout revokes pending work and removes only the specified user’s recovery records', () => {
    const version = currencyOperationSession('logout-test')
    storeSignedCurrencyOperation('logout-test', 'one', { signature: '0xaa' })
    storeSignedCurrencyOperation('another-user', 'one', { signature: '0xbb' })
    clearUserCurrencyOperations('logout-test')
    expect(() => assertCurrencyOperationSession('logout-test', version)).toThrow()
    expect(readSignedCurrencyOperation('logout-test', 'one')).toBeNull()
    expect(readSignedCurrencyOperation('another-user', 'one')).toEqual({ signature: '0xbb' })
    clearUserCurrencyOperations('another-user')
})

it('serializes one operation across callers and permits a retry after the first finishes', async () => {
    let finish!: () => void
    const work = jest.fn(
        () =>
            new Promise<void>((resolve) => {
                finish = resolve
            })
    )
    const first = guardCurrencyOperation('guard-test', 'one', work)
    await guardCurrencyOperation('guard-test', 'one', work)
    expect(work).toHaveBeenCalledTimes(1)
    finish()
    await first
    await guardCurrencyOperation('guard-test', 'one', async () => {
        work.mockClear()
    })
    expect(work).not.toHaveBeenCalled()
})

it('keeps the device record readable if its removal fails', () => {
    storeSignedCurrencyOperation('remove-test', 'one', { signature: '0xcc' })
    const remove = jest.spyOn(Storage.prototype, 'removeItem').mockImplementationOnce(() => {
        throw new Error('storage unavailable')
    })
    expect(() => clearSignedCurrencyOperation('remove-test', 'one')).not.toThrow()
    expect(readSignedCurrencyOperation('remove-test', 'one')).toEqual({ signature: '0xcc' })
    remove.mockRestore()
    clearUserCurrencyOperations('remove-test')
})

it('merges 2,000 history entries without duplicating earlier pages', () => {
    const entries = Array.from({ length: 2000 }, (_, id) => ({
        id: String(id),
        amount: '1',
        kind: 'TRANSFER',
        direction: 'CREDIT' as const,
        currency: 'EUR' as const,
        asset: 'EURC' as const,
        txHash: null,
        at: '2026-10-11T10:00:00Z',
    }))
    const pages: CurrencyHistoryResponse[] = [
        { entries, operations: [], cursor: 'next', hasMore: true },
        { entries, operations: [], cursor: null, hasMore: false },
    ]
    expect(mergeCurrencyHistory(pages).entries).toHaveLength(2000)
})
