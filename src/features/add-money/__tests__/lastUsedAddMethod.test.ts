import { readLastDepositMethod, saveLastDepositMethod, splitLastUsed } from '../lastUsedAddMethod'
import type { AddMoneyPickerMethod } from '../addMoneyMethods'

const argentina: AddMoneyPickerMethod[] = ['ars', 'bank', 'crypto']
const everyRow = (split: ReturnType<typeof splitLastUsed<AddMoneyPickerMethod>>) =>
    [split.lastUsed, ...split.others].filter(Boolean).sort()

describe('splitLastUsed', () => {
    it('with no stored method, keeps the list as it is and shows no last used row', () => {
        expect(splitLastUsed(argentina, null)).toEqual({ lastUsed: null, others: ['ars', 'bank', 'crypto'] })
        expect(splitLastUsed(argentina, undefined)).toEqual({ lastUsed: null, others: ['ars', 'bank', 'crypto'] })
    })

    it('moves the stored method out and keeps the others in order', () => {
        expect(splitLastUsed(argentina, 'crypto')).toEqual({ lastUsed: 'crypto', others: ['ars', 'bank'] })
        expect(splitLastUsed(argentina, 'ars')).toEqual({ lastUsed: 'ars', others: ['bank', 'crypto'] })
    })

    it.each([
        ['a method this user no longer has (moved out of Argentina)', 'ars', ['bank', 'crypto']],
        ['a method that no longer exists', 'more', ['bank', 'crypto']],
        ['an old "Bank accounts" row', 'account', ['pix', 'bank', 'crypto']],
        ['a value that is not a string', { method: 'bank' }, ['bank', 'crypto']],
    ] as const)('ignores %s', (_, stored, methods) => {
        expect(splitLastUsed(methods as readonly AddMoneyPickerMethod[], stored)).toEqual({
            lastUsed: null,
            others: methods,
        })
    })

    it.each([null, 'ars', 'bank', 'crypto', 'pix'])('never drops a row (stored %p)', (stored) => {
        const split = splitLastUsed(argentina, stored)
        expect(everyRow(split)).toEqual([...argentina].sort())
    })
})

describe('the stored method', () => {
    beforeEach(() => localStorage.clear())

    it('reads back what was saved, and nothing before that', () => {
        expect(readLastDepositMethod()).toBeNull()
        saveLastDepositMethod('bank')
        expect(readLastDepositMethod()).toBe('bank')
    })
})
