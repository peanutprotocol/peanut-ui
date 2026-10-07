/**
 * The stored set must be readable from the cached /users/me in the same
 * render (item 3b): the SDK opens on it right after the save.
 */
import React from 'react'
import { act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import { USER } from '@/constants/query.consts'
import { __resetOneShotSessionForTests, useOneShotSession } from '@/hooks/useOneShotSession'
import { useSaveKycIntents } from '@/hooks/useSaveKycIntents'

const setIntents = jest.fn()
jest.mock('@/services/kyc-intents', () => ({
    ...jest.requireActual('@/services/kyc-intents'),
    kycIntentsApi: { set: (...args: unknown[]) => setIntents(...args) },
}))

const SET = { qr: true, local: false, card: false, bank: true }
const SAVED = { intents: SET, setAt: '2026-10-07T10:00:00.000Z' }

function renderSave(client: QueryClient) {
    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client }, children)
    return renderHook(() => ({ save: useSaveKycIntents(), saved: useOneShotSession()?.intents ?? null }), { wrapper })
}

describe('useSaveKycIntents', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        __resetOneShotSessionForTests()
        setIntents.mockResolvedValue(SAVED)
    })

    it('stores the set and writes it into the cached user', async () => {
        const client = new QueryClient()
        client.setQueryData([USER], {
            user: { userId: 'u1' },
            identityVerification: { status: 'verified', oneShot: true },
        })
        const { result } = renderSave(client)

        expect(result.current.saved).toBeNull()
        let saved
        await act(async () => {
            saved = await result.current.save(SET)
        })

        expect(setIntents).toHaveBeenCalledWith(SET)
        expect(saved).toEqual(SAVED)
        // the tab's copy, for a read before /users/me reflects the save
        expect(result.current.saved).toEqual(SET)
        expect(client.getQueryData([USER])).toEqual({
            user: { userId: 'u1' },
            identityVerification: {
                status: 'verified',
                oneShot: true,
                kycIntents: SET,
                kycIntentsSetAt: SAVED.setAt,
            },
        })
    })

    it('leaves a user with no identity block alone', async () => {
        const client = new QueryClient()
        client.setQueryData([USER], { user: { userId: 'u1' } })
        const { result } = renderSave(client)
        await act(async () => {
            await result.current.save(SET)
        })
        expect(client.getQueryData([USER])).toEqual({ user: { userId: 'u1' } })
        expect(result.current.saved).toEqual(SET)
    })

    it('a failed save writes nothing', async () => {
        setIntents.mockRejectedValue(new Error('Failed to save kyc intents: 500'))
        const client = new QueryClient()
        client.setQueryData([USER], { identityVerification: { status: 'verified' } })
        const { result } = renderSave(client)
        await expect(result.current.save(SET)).rejects.toThrow('500')
        expect(client.getQueryData([USER])).toEqual({ identityVerification: { status: 'verified' } })
        expect(result.current.saved).toBeNull()
    })
})
