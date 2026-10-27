/**
 * Slava, 2026-10-27: answers typed before the ID check survive a phone
 * restart. They stay on the device until Sumsub has them, then leave.
 */
import { act, renderHook } from '@testing-library/react'
import { saveKycAnswers } from '@/app/actions/kyc-paperwork-verification'
import type { PaperworkVerificationStep } from '@/app/actions/types/kyc-paperwork-verification.types'
import { useOptionalAuth } from '@/context/authContext'
import {
    forgetAnswerDraft,
    forgetSavedAnswers,
    keepAnswerDraft,
    readAnswerDraft,
    withAnswerDraft,
} from '../answerDraft'
import { useAnswerForm } from '../useAnswerForm'

jest.mock('@/app/actions/kyc-paperwork-verification', () => ({ saveKycAnswers: jest.fn() }))
jest.mock('@/context/authContext', () => ({ useOptionalAuth: jest.fn() }))
const save = jest.mocked(saveKycAnswers)
const auth = jest.mocked(useOptionalAuth)
const signedIn = (userId: string) => auth.mockReturnValue({ user: { user: { userId } } } as never)

const PHONE: PaperworkVerificationStep = {
    id: 'phone',
    features: ['card'],
    answered: false,
    fields: [{ key: 'phone', kind: 'phone', required: true, value: null }],
}
const BIRTH: PaperworkVerificationStep = {
    id: 'birth',
    features: ['bank'],
    answered: false,
    fields: [
        { key: 'countryOfBirth', kind: 'country', required: true, value: null },
        { key: 'cityOfBirth', kind: 'place', required: true, value: null },
    ],
}

beforeEach(() => {
    window.localStorage.clear()
    jest.useRealTimers()
    save.mockReset()
    signedIn('user-1')
})

describe('the device draft', () => {
    test('belongs to one account', () => {
        keepAnswerDraft('user-1', { phone: '+351 912 345 678' })
        expect(readAnswerDraft('user-1')).toEqual({ phone: '+351 912 345 678' })
        expect(readAnswerDraft('user-2')).toEqual({})
        expect(readAnswerDraft(undefined)).toEqual({})
    })

    test('never keeps the tax number', () => {
        keepAnswerDraft('user-1', { taxId: '412-55-0198' })
        expect(window.localStorage.length).toBe(0)
        keepAnswerDraft('user-1', { taxId: '412-55-0198', street: 'Rua Augusta 1' })
        expect(readAnswerDraft('user-1')).toEqual({ street: 'Rua Augusta 1' })
    })

    test('drops what a save stored and keeps an answer edited since', () => {
        keepAnswerDraft('user-1', { countryOfBirth: 'UA', cityOfBirth: 'Kyiv' })
        forgetSavedAnswers('user-1', { countryOfBirth: 'UA', cityOfBirth: 'Odesa' })
        expect(readAnswerDraft('user-1')).toEqual({ cityOfBirth: 'Kyiv' })
        forgetSavedAnswers('user-1', { cityOfBirth: 'Kyiv' })
        expect(window.localStorage.length).toBe(0)
    })

    test('is gone after a week', () => {
        jest.useFakeTimers({ now: new Date('2026-10-27T10:00:00Z') })
        keepAnswerDraft('user-1', { phone: '+351 912 345 678' })
        jest.setSystemTime(new Date('2026-11-03T10:00:01Z'))
        expect(readAnswerDraft('user-1')).toEqual({})
        expect(window.localStorage.length).toBe(0)
    })

    test('fills only what the server has no value for, never a locked field', () => {
        const fields = [
            { key: 'phone', kind: 'phone' as const, required: true, value: '+14155550100' },
            { key: 'sex', kind: 'choice' as const, required: true, value: null, locked: true },
            { key: 'occupation', kind: 'choice' as const, required: true, value: null },
        ]
        const draft = { phone: '+351 912 345 678', sex: 'female', occupation: 'teacher' }
        expect(withAnswerDraft({ phone: '+14155550100', sex: '', occupation: '' }, fields, draft)).toEqual({
            phone: '+14155550100',
            sex: '',
            occupation: 'teacher',
        })
    })

    test('a device without storage keeps the answers in memory only', () => {
        const setItem = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('QuotaExceededError')
        })
        expect(() => keepAnswerDraft('user-1', { phone: '+1' })).not.toThrow()
        setItem.mockRestore()
    })
})

describe('a question screen', () => {
    test('opens after a restart with what was typed but not saved', () => {
        const before = renderHook(() => useAnswerForm([BIRTH]))
        act(() => before.result.current.change('countryOfBirth', 'UA'))
        act(() => before.result.current.change('cityOfBirth', 'Odesa'))
        before.unmount()

        const after = renderHook(() => useAnswerForm([BIRTH]))
        expect(after.result.current.values).toEqual({ countryOfBirth: 'UA', cityOfBirth: 'Odesa' })
    })

    test('forgets the answers once Sumsub has them', async () => {
        save.mockResolvedValue({ kind: 'saved', next: null })
        const { result } = renderHook(() => useAnswerForm([PHONE]))
        act(() => result.current.change('phone', '+351 912 345 678'))
        expect(readAnswerDraft('user-1')).toEqual({ phone: '+351 912 345 678' })
        await act(async () => {
            await result.current.save()
        })
        expect(save).toHaveBeenCalledWith('phone', { phone: '+351912345678' }, undefined)
        expect(readAnswerDraft('user-1')).toEqual({})
    })

    test('keeps the answers when the save fails', async () => {
        save.mockResolvedValue({ kind: 'retry' })
        const { result } = renderHook(() => useAnswerForm([PHONE]))
        act(() => result.current.change('phone', '+351 912 345 678'))
        await act(async () => {
            await result.current.save()
        })
        expect(readAnswerDraft('user-1')).toEqual({ phone: '+351 912 345 678' })
    })

    test('signed out, nothing is written to the device', () => {
        auth.mockReturnValue(null)
        const { result } = renderHook(() => useAnswerForm([PHONE]))
        act(() => result.current.change('phone', '+351 912 345 678'))
        expect(window.localStorage.length).toBe(0)
        forgetAnswerDraft(undefined)
    })
})
