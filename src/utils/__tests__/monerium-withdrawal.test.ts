import {
    clearMoneriumWithdrawal,
    moneriumEuroAmount,
    moneriumOperationFinal,
    readMoneriumWithdrawal,
    storeMoneriumWithdrawal,
} from '../monerium-withdrawal'

const requestKey = '0b0f7e0e-4a3c-4e16-8d1c-5f5a1d9b2c11'
const attempt = {
    requestKey,
    amount: '10.50',
    externalAccountId: 'iban-alice',
    prepared: { operationId: 'operation-alice', message: 'Send euros to Alice', status: 'READY' as const },
    signature: '0xabcd' as const,
    submitAttempted: true,
}

afterEach(() => {
    clearMoneriumWithdrawal('alice')
    clearMoneriumWithdrawal('bob')
    localStorage.clear()
})

it.each([
    '',
    '0',
    '0.00',
    '-1',
    '+1',
    '1e3',
    'NaN',
    'Infinity',
    '10.123',
    '0,001',
    '1,234.5',
    '١٢',
    '１２',
    '1 000',
    '9'.repeat(19),
])('rejects malformed or non-positive amount %s', (amount) => {
    expect(moneriumEuroAmount(amount)).toBeNull()
})

it('normalizes cents exactly over 5,000 seeded cases without floating point rounding (seed 42161)', () => {
    let seed = 42161
    for (let i = 0; i < 5000; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
        const cents = BigInt(seed || 1)
        const expected = `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`
        expect(moneriumEuroAmount(expected)).toBe(expected)
        expect(moneriumEuroAmount(expected.replace('.', ','))).toBe(expected)
        expect(moneriumEuroAmount(`${expected}1`)).toBeNull()
    }
    expect(moneriumEuroAmount('999999999999999999,99')).toBe('999999999999999999.99')
})

it('keeps attempt, operation and signature together and isolates them by user', () => {
    storeMoneriumWithdrawal('alice', attempt)
    expect(readMoneriumWithdrawal('alice')).toEqual(attempt)
    expect(readMoneriumWithdrawal('bob')).toBeNull()
    expect(JSON.parse(localStorage.getItem('monerium-withdrawal:alice')!)).toEqual(attempt)
    clearMoneriumWithdrawal('alice', 'a-different-operation')
    expect(readMoneriumWithdrawal('alice')).toEqual(attempt)
    clearMoneriumWithdrawal('alice', attempt.prepared.operationId)
    expect(readMoneriumWithdrawal('alice')).toBeNull()
})

it('rejects corrupt device recovery records', () => {
    for (const stored of [
        '{',
        'null',
        '{}',
        JSON.stringify({ ...attempt, signature: 'not-a-signature' }),
        JSON.stringify({ ...attempt, prepared: { operationId: 'wrong' } }),
    ]) {
        localStorage.setItem('monerium-withdrawal:bob', stored)
        expect(readMoneriumWithdrawal('bob')).toBeNull()
    }
})

it('clears only the logging-out user and preserves another user recovery', () => {
    storeMoneriumWithdrawal('alice', attempt)
    storeMoneriumWithdrawal('bob', { ...attempt, externalAccountId: 'iban-bob' })
    clearMoneriumWithdrawal('alice')
    expect(readMoneriumWithdrawal('alice')).toBeNull()
    expect(readMoneriumWithdrawal('bob')?.externalAccountId).toBe('iban-bob')
})

it.each(['COMPLETED', 'FAILED', 'CANCELLED', 'NEEDS_REVIEW'])('stops polling at %s', (status) => {
    expect(moneriumOperationFinal(status)).toBe(true)
})

it.each(['READY', 'SUBMITTED', 'PROCESSING', 'UNKNOWN'])('does not report %s as terminal', (status) => {
    expect(moneriumOperationFinal(status)).toBe(false)
})
