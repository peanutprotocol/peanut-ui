/** Spec-only real-boundary tests. No production behavior may live in the adapter.
 * Header literals live in the separate frozen public-contract file supplied by this author. */
import { describe, expect, jest, test } from '@jest/globals'
import { createLegacySdkHarness } from './legacyExplicitStart.acceptance-adapter'
import { START_HEADER, START_VALUE, OWNER_HEADER } from './legacyExplicitStart.public-contract'

type Request = { method: string; url: string; headers: Record<string, string>; body: unknown; accountId: string }
const initiatingHeaders = (userId = 'user-a') => ({ [START_HEADER]: START_VALUE, [OWNER_HEADER]: userId })
const isStart = (r: Request) => r.method === 'POST' && r.url === '/users/identity'
const isOpened = (r: Request) => r.method === 'POST' && r.url === '/users/kyc/opened'
function ui(initialMode: 'dedicated' | 'fallback' = 'fallback') {
    // Response facts are selected BEFORE entry; the real SDK callback chooses its later path.
    const initialBody =
        initialMode === 'dedicated'
            ? {
                  token: 'synthetic-test-token',
                  session: {
                      id: 'session-a',
                      generation: 1,
                      state: 'COLLECTING',
                      reasonCode: null,
                      targetCountry: 'AR',
                      externalActionId: 'action-a',
                      isMultiLevel: false,
                  },
              }
            : { token: 'synthetic-test-token' }
    let initialResponseDelivered = false
    const request = jest
        .fn<(r: Request) => Promise<{ status: number; body: unknown }>>()
        .mockImplementation(async (r) => {
            if (isStart(r) && !initialResponseDelivered) {
                initialResponseDelivered = true
                return { status: 200, body: initialBody }
            }
            return { status: 200, body: { token: 'synthetic-test-token' } }
        })
    return { request, h: createLegacySdkHarness({ request, sessionMode: 'cookie-only' }) }
}

describe('actual SDK initial request and refresh responsibility', () => {
    test('real initial SDK request carries explicit entry and initiating-owner headers in cookie-only session', async () => {
        const { h, request } = ui()
        try {
            await h.enter({ userId: 'user-a' })
            await h.flush()
            const calls = request.mock.calls.map(([r]) => r),
                starts = calls.filter(isStart)
            expect(starts).toHaveLength(1)
            expect(starts[0].headers).toMatchObject(initiatingHeaders())
            expect(starts[0].headers.authorization).toBeUndefined()
            expect(starts[0].accountId).toBe('user-a')
            expect(calls.filter(isOpened)).toEqual([])
            expect(h.usable()).toBe(true)
        } finally {
            await h.dispose()
        }
    })
    test('SDK rerenders do not add opened POSTs or duplicate initial requests', async () => {
        const { h, request } = ui()
        try {
            await h.enter({ userId: 'user-a' })
            await h.flush()
            for (let i = 0; i < 5; i++) await h.rerender()
            await h.flush()
            const calls = request.mock.calls.map(([r]) => r)
            expect(calls.filter(isStart)).toHaveLength(1)
            expect(calls.filter(isOpened)).toEqual([])
        } finally {
            await h.dispose()
        }
    })
    test.each(['dedicated', 'fallback'] as const)(
        '%s refresh never carries the initial-entry flag or sends opened POST',
        async (mode) => {
            const { h, request } = ui(mode)
            try {
                await h.enter({ userId: 'user-a' })
                await h.flush()
                const initial = request.mock.calls.map(([r]) => r).filter(isStart)
                expect(initial).toHaveLength(1)
                expect(initial[0].headers).toMatchObject(initiatingHeaders())
                expect(initial[0].headers.authorization).toBeUndefined()
                expect(initial[0].accountId).toBe('user-a')
                expect(request.mock.calls.map(([r]) => r).filter(isOpened)).toEqual([])
                request.mockClear()
                await h.refresh()
                await h.flush()
                const calls = request.mock.calls.map(([r]) => r)
                const expectedPath = mode === 'dedicated' ? '/users/identity/session-token' : '/users/identity'
                expect(calls.some((r) => r.method === 'POST' && r.url === expectedPath)).toBe(true)
                if (mode === 'dedicated')
                    expect(calls.find((r) => r.method === 'POST' && r.url === expectedPath)!.body).toEqual({
                        sessionId: 'session-a',
                        generation: 1,
                    })
                for (const r of calls) expect(r.headers[START_HEADER]).toBeUndefined()
                expect(calls.filter(isOpened)).toEqual([])
                expect(h.usable()).toBe(true)
            } finally {
                await h.dispose()
            }
        }
    )
    test('feature-question surface never adds an opened POST', async () => {
        const { h, request } = ui()
        try {
            await h.mountFeatureQuestions()
            await h.flush()
            expect(request.mock.calls.map(([r]) => r).filter(isOpened)).toEqual([])
        } finally {
            await h.dispose()
        }
    })
})
