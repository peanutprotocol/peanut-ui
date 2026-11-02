import { act, renderHook } from '@testing-library/react'
import { saveKycAnswers } from '@/app/actions/kyc-paperwork-verification'
import type { PaperworkVerificationStep } from '@/app/actions/types/kyc-paperwork-verification.types'
import { getAuthToken, setAuthToken, tokenUserId } from '@/utils/auth-token'
import { keepAnswerDraft, readAnswerDraft } from '../answerDraft'
import { saveSteps, useAnswerForm } from '../useAnswerForm'

jest.mock('@/app/actions/kyc-paperwork-verification', () => ({ saveKycAnswers: jest.fn() }))
let mockUserId = 'user-a'
jest.mock('@/context/authContext', () => ({
    useOptionalAuth: () => ({ user: { user: { userId: mockUserId } } }),
}))
const jwt = (userId: string) => `x.${btoa(JSON.stringify({ userId }))}.y`
const step = (id: PaperworkVerificationStep['id'], key: string): PaperworkVerificationStep => ({
    id,
    features: ['base'],
    fields: [{ key, kind: 'choice', required: true, options: ['a', 'b'], value: 'a' }],
    answered: false,
})
const steps = [step('purpose', 'bankPurpose'), step('work', 'employmentStatus')]
const values = { bankPurpose: 'a', employmentStatus: 'b' }
const save = jest.mocked(saveKycAnswers)

beforeEach(() => {
    window.sessionStorage.clear()
    mockUserId = 'user-a'
    setAuthToken(jwt('user-a'))
    save.mockReset().mockResolvedValue({ kind: 'saved', next: null })
})

describe('answer writes belong to their initiating account', () => {
    it('forwards the expected user to every answer PUT', async () => {
        await saveSteps(steps, values, 'bank', 'user-a')
        expect(save.mock.calls).toEqual([
            ['purpose', { bankPurpose: 'a' }, 'bank', 'user-a'],
            ['work', { employmentStatus: 'b' }, 'bank', 'user-a'],
        ])
    })

    it('stops the next step when the real shared token changes from A to B', async () => {
        const sentAs: (string | null)[] = []
        save.mockImplementation(async () => {
            sentAs.push(tokenUserId(getAuthToken()))
            setAuthToken(jwt('user-b'))
            return { kind: 'saved', next: null }
        })
        await saveSteps(steps, values, undefined, 'user-a')
        expect(sentAs).toEqual(['user-a'])
        expect(save).toHaveBeenCalledWith('purpose', { bankPurpose: 'a' }, undefined, 'user-a')
    })

    it('does not send any answer when the current token belongs to another account', async () => {
        setAuthToken(jwt('user-b'))
        await saveSteps(steps, values, undefined, 'user-a')
        expect(save).not.toHaveBeenCalled()
    })

    it('a same-user token rotation preserves the batch and its expected identity', async () => {
        save.mockImplementationOnce(async () => {
            setAuthToken(`x.${btoa(JSON.stringify({ userId: 'user-a', refreshed: true }))}.y`)
            return { kind: 'saved', next: null }
        })
        await saveSteps(steps, values, undefined, 'user-a')
        expect(save).toHaveBeenCalledTimes(2)
        expect(save.mock.calls.every((call) => call[3] === 'user-a')).toBe(true)
    })

    it('unmounting while a grouped save is pending stops the remaining step', async () => {
        let finish!: (reply: Awaited<ReturnType<typeof saveKycAnswers>>) => void
        save.mockReturnValueOnce(
            new Promise((resolve) => {
                finish = resolve
            })
        )
        const view = renderHook(() => useAnswerForm(steps))
        let pending!: ReturnType<typeof view.result.current.save>
        act(() => {
            pending = view.result.current.save()
        })
        expect(save).toHaveBeenCalledTimes(1)
        view.unmount()
        await act(async () => {
            finish({ kind: 'saved', next: null })
            await pending
        })
        expect(save).toHaveBeenCalledTimes(1)
    })

    it('a late A acknowledgement cannot erase B’s draft with the same field value', async () => {
        keepAnswerDraft('user-b', { bankPurpose: 'a' })
        let finish!: (reply: Awaited<ReturnType<typeof saveKycAnswers>>) => void
        save.mockReturnValueOnce(
            new Promise((resolve) => {
                finish = resolve
            })
        )
        const view = renderHook(() => useAnswerForm([steps[0]]))
        let pending!: ReturnType<typeof view.result.current.save>
        act(() => {
            pending = view.result.current.save()
        })
        mockUserId = 'user-b'
        setAuthToken(jwt('user-b'))
        view.rerender()
        await act(async () => {
            finish({ kind: 'saved', next: null })
            await pending
        })
        expect(readAnswerDraft('user-b')).toEqual({ bankPurpose: 'a' })
        expect(save).toHaveBeenCalledTimes(1)
    })
})
