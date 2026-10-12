import React from 'react'
import { act, waitFor } from '@testing-library/react'
import { hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { useKeepWebBypass } from '@/hooks/useKeepWebBypass'
import { KEEP_WEB_COOKIE, KEEP_WEB_TOKEN } from '@/constants/migration.consts'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'

jest.mock('react-dom/server', () => jest.requireActual('react-dom/server.node'))
const mockCapture = jest.fn()
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: (...args: unknown[]) => mockCapture(...args) },
    capture: (...args: unknown[]) => mockCapture(...args),
}))

const observed: boolean[] = []
function Probe() {
    const bypass = useKeepWebBypass()
    observed.push(bypass)
    return <output>{String(bypass)}</output>
}

describe('web bypass hydration contract', () => {
    let container: HTMLDivElement
    let root: Root | undefined
    beforeEach(() => {
        jest.clearAllMocks()
        observed.length = 0
        document.cookie = `${KEEP_WEB_COOKIE}=; max-age=0; path=/`
        window.history.replaceState({}, '', '/')
        container = document.createElement('div')
        document.body.appendChild(container)
    })
    afterEach(() => {
        if (root) act(() => root!.unmount())
        root = undefined
        container.remove()
        document.cookie = `${KEEP_WEB_COOKIE}=; max-age=0; path=/`
        window.history.replaceState({}, '', '/')
    })

    it('ignores an existing cookie on the server and first hydration, then applies it without replacing DOM', async () => {
        document.cookie = `${KEEP_WEB_COOKIE}=${encodeURIComponent(JSON.stringify(KEEP_WEB_TOKEN))}; path=/`
        container.innerHTML = renderToString(<Probe />)
        expect(container).toHaveTextContent('false')
        const node = container.querySelector('output')
        observed.length = 0
        const onRecoverableError = jest.fn()
        await act(async () => {
            root = hydrateRoot(container, <Probe />, { onRecoverableError })
        })
        expect(observed[0]).toBe(false)
        await waitFor(() => expect(container).toHaveTextContent('true'))
        expect(container.querySelector('output')).toBe(node)
        expect(onRecoverableError).not.toHaveBeenCalled()
        expect(mockCapture).not.toHaveBeenCalled()
    })

    it('persists a valid query token and emits the usage event once', async () => {
        window.history.replaceState({}, '', `/?keep-web=${encodeURIComponent(KEEP_WEB_TOKEN)}`)
        container.innerHTML = renderToString(<Probe />)
        expect(container).toHaveTextContent('false')
        const onRecoverableError = jest.fn()
        await act(async () => {
            root = hydrateRoot(container, <Probe />, { onRecoverableError })
        })
        await waitFor(() => expect(container).toHaveTextContent('true'))
        expect(document.cookie).toContain(`${KEEP_WEB_COOKIE}=${encodeURIComponent(JSON.stringify(KEEP_WEB_TOKEN))}`)
        expect(
            mockCapture.mock.calls.filter(([event]) => event === ANALYTICS_EVENTS.MIGRATION_KEEP_WEB_USED)
        ).toHaveLength(1)
        await act(async () => {
            root!.render(<Probe />)
        })
        expect(
            mockCapture.mock.calls.filter(([event]) => event === ANALYTICS_EVENTS.MIGRATION_KEEP_WEB_USED)
        ).toHaveLength(1)
        expect(onRecoverableError).not.toHaveBeenCalled()
    })
})
