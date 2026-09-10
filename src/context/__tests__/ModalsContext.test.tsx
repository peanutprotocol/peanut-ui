/**
 * The support prefill is redacted where it enters, not where it leaves.
 *
 * Call sites hand over `window.location.href` (ClaimErrorView,
 * Error.validation.view), and on a claim page the URL fragment is the bearer
 * password for the funds — it derives the private claim key. The prefill then
 * reaches Crisp two ways: the composer, and the `support_topic` row the app
 * publishes on open, before the user has decided to send anything. Redacting in
 * the setter covers both sinks and every call site, including ones not written
 * yet.
 */
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { ModalsProvider, useModalsContext } from '../ModalsContext'

const wrapper = ({ children }: { children: ReactNode }) => <ModalsProvider>{children}</ModalsProvider>

describe('ModalsContext support prefill', () => {
    it('never stores a claim password, however the call site phrases it', () => {
        const { result } = renderHook(() => useModalsContext(), { wrapper })

        act(() => {
            result.current.openSupportWithMessage(
                "I can't claim this: https://peanut.me/claim?c=42161&v=v4.3&i=17#p=Xy7SecretPw"
            )
        })

        expect(result.current.supportPrefilledMessage).not.toContain('Xy7SecretPw')
        // the query locates the deposit — an agent still needs it
        expect(result.current.supportPrefilledMessage).toContain('?c=42161&v=v4.3&i=17')
        expect(result.current.isSupportModalOpen).toBe(true)
    })

    /*
     * A prefill belongs to the open cycle that set it. Nothing used to clear it,
     * so after one "contact support about X" every later open — the nav button
     * included — reopened with X still in the composer and reported X as the
     * topic.
     */
    it('clears the prefill when support closes', () => {
        const { result } = renderHook(() => useModalsContext(), { wrapper })

        act(() => result.current.openSupportWithMessage('my withdrawal is stuck'))
        expect(result.current.supportPrefilledMessage).toBe('my withdrawal is stuck')

        act(() => result.current.setIsSupportModalOpen(false))
        expect(result.current.supportPrefilledMessage).toBe('')
    })
})
