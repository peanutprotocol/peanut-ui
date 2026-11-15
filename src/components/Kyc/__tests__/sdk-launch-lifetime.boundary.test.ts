import { act } from '@testing-library/react'
import { renderHookWithIntl } from '@/test-utils/intl'
import { useSumsubWebSdk } from '../useSumsubWebSdk'

// Focused real WebSDK boundary diagnostic derived from the frozen lifetime
// contract. The full real-card acceptance suite remains a separate gate.
test('a retired SDK launch cannot refresh or complete its replacement', async () => {
    const launches: Array<{ refresh: () => Promise<string>; events: Record<string, () => void> }> = []
    window.snsWebSdk = {
        init: (_token: string, refresh: () => Promise<string>) => {
            const launch = { refresh, events: {} as Record<string, () => void> }
            launches.push(launch)
            const builder = {
                withConf: () => builder,
                withOptions: () => builder,
                on: (name: string, callback: () => void) => {
                    launch.events[name] = callback
                    return builder
                },
                build: () => ({ launch: jest.fn(), destroy: jest.fn() }),
            }
            return builder
        },
    } as unknown as typeof window.snsWebSdk
    const refreshA = jest.fn().mockResolvedValue('token-a')
    const refreshB = jest.fn().mockResolvedValue('token-b')
    const completeA = jest.fn()
    const completeB = jest.fn()
    const initial = {
        visible: true,
        sessionKey: 'a',
        accessToken: 'token-a',
        onRefreshToken: refreshA,
        onComplete: completeA,
    }
    const { result, rerender, unmount } = renderHookWithIntl((props: typeof initial) => useSumsubWebSdk(props), {
        initialProps: initial,
    })
    try {
        act(() => result.current.setSdkContainer(document.createElement('div')))
        const old = launches[0]
        expect(old).toBeDefined()
        rerender({ ...initial, visible: false })
        rerender({
            visible: true,
            sessionKey: 'b',
            accessToken: 'token-b',
            onRefreshToken: refreshB,
            onComplete: completeB,
        })
        expect(launches).toHaveLength(2)
        const oldResult = await old.refresh().then(
            (value) => ({ value }),
            (error) => ({ error })
        )
        act(() => old.events.onApplicantSubmitted())
        expect(JSON.stringify(oldResult)).not.toContain('token-b')
        expect(refreshB).not.toHaveBeenCalled()
        expect(completeB).not.toHaveBeenCalled()
        await expect(launches[1].refresh()).resolves.toBe('token-b')
        act(() => launches[1].events.onApplicantSubmitted())
        expect(completeB).toHaveBeenCalledTimes(1)
    } finally {
        unmount()
        delete (window as unknown as { snsWebSdk?: unknown }).snsWebSdk
    }
})
