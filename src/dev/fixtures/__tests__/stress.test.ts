import { STRESS_VALUES, stressResponse } from '@/dev/fixtures/stress'

describe('stressResponse', () => {
    it('rewrites names, emails, memos and amounts by field name', () => {
        const out = stressResponse({
            user: { fullName: 'Demo User', email: 'demo@peanut.me', username: 'demo' },
            memo: 'Coffee',
            amount: '8.50',
        }) as Record<string, any>

        expect(STRESS_VALUES.name).toContain(out.user.fullName)
        expect(STRESS_VALUES.email).toContain(out.user.email)
        expect(STRESS_VALUES.username).toContain(out.user.username)
        expect(STRESS_VALUES.text).toContain(out.memo)
        expect(STRESS_VALUES.amount).toContain(out.amount)
    })

    it('keeps empty and missing values, so empty states stay empty', () => {
        expect(stressResponse({ lastName: '', entries: [], amount: null })).toEqual({
            lastName: '',
            entries: [],
            amount: null,
        })
    })

    it('leaves non-numeric amounts and unknown fields alone', () => {
        expect(stressResponse({ amount: 'n/a', status: 'COMPLETED', type: 'peanut-wallet' })).toEqual({
            amount: 'n/a',
            status: 'COMPLETED',
            type: 'peanut-wallet',
        })
    })

    it('grows row lists to 50 with unique ids, but not config arrays', () => {
        const out = stressResponse({
            entries: [{ uuid: 'tx-1' }, { uuid: 'tx-2' }],
            rails: [{ id: 'bridge.ach_us' }],
        }) as { entries: { uuid: string }[]; rails: unknown[] }

        expect(out.entries).toHaveLength(50)
        expect(new Set(out.entries.map((e) => e.uuid)).size).toBe(50)
        expect(out.rails).toEqual([{ id: 'bridge.ach_us' }])
    })

    it('keeps every email within the 254-character limit', () => {
        for (const email of STRESS_VALUES.email) expect(email.length).toBeLessThanOrEqual(254)
    })
})

describe('stressResponse rows', () => {
    it('gives neighbouring rows different names and amounts', () => {
        const out = stressResponse({
            entries: [{ uuid: 'a', amount: '1', senderAccount: { fullName: 'A', username: 'a' } }],
        }) as { entries: { amount: string; senderAccount: { fullName: string } }[] }

        expect(new Set(out.entries.slice(0, 4).map((e) => e.amount)).size).toBe(4)
        expect(new Set(out.entries.slice(0, 4).map((e) => e.senderAccount.fullName)).size).toBe(4)
    })
})
