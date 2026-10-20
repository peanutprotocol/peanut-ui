import React from 'react'
import { act, renderHook } from '@testing-library/react'
import { hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { useHydrationPathname } from '@/hooks/useHydrationPathname'
import { isMarketingRoute } from '@/utils/marketing-routes'

jest.mock('react-dom/server', () => jest.requireActual('react-dom/server.node'))
let mockPathname: string | null = '/'
let mockSegments: string[] | null = []
jest.mock('next/navigation', () => ({
    usePathname: () => mockPathname,
    useSelectedLayoutSegments: () => mockSegments,
}))

const observed: Array<string | null> = []
function Probe() {
    const pathname = useHydrationPathname()
    observed.push(pathname)
    return <div data-testid="provider" data-provider={isMarketingRoute(pathname) ? 'marketing' : 'app'} />
}

describe('root-layout pathname hydration snapshot', () => {
    let container: HTMLDivElement
    let root: Root | undefined
    let nativeBuild: string | undefined
    beforeEach(() => {
        nativeBuild = process.env.NEXT_PUBLIC_CAPACITOR_BUILD
        delete process.env.NEXT_PUBLIC_CAPACITOR_BUILD
        mockPathname = '/'
        mockSegments = []
        observed.length = 0
        container = document.createElement('div')
        document.body.appendChild(container)
    })
    afterEach(() => {
        if (root) act(() => root!.unmount())
        root = undefined
        container.remove()
        if (nativeBuild === undefined) delete process.env.NEXT_PUBLIC_CAPACITOR_BUILD
        else process.env.NEXT_PUBLIC_CAPACITOR_BUILD = nativeBuild
    })

    it.each(['/setup', '/home/'])('preserves root provider HTML when the browser URL is %s', async (pathname) => {
        container.innerHTML = renderToString(<Probe />)
        const provider = container.querySelector('[data-testid="provider"]')
        expect(provider).toHaveAttribute('data-provider', 'marketing')
        observed.length = 0
        mockPathname = pathname
        const onRecoverableError = jest.fn()

        await act(async () => {
            root = hydrateRoot(container, <Probe />, { onRecoverableError })
        })

        expect(observed[0]).toBe('/')
        expect(observed.at(-1)).toBe(pathname)
        expect(container.querySelector('[data-testid="provider"]')).toBe(provider)
        expect(provider).toHaveAttribute('data-provider', 'app')
        expect(onRecoverableError).not.toHaveBeenCalled()
    })

    it.each([
        [[], '/'],
        [['(marketing)'], '/'],
        [['(setup)', 'setup'], '/setup'],
        [['(mobile-ui)', 'home'], '/home'],
        [['es-ar', '(marketing)', 'help', 'topic/subtopic'], '/es-ar/help/topic/subtopic'],
        [null, null],
    ] as Array<[string[] | null, string | null]>)(
        'uses structural segments %p as %p on the server',
        (segments, expected) => {
            mockSegments = segments
            mockPathname = '/different-browser-path'
            renderToString(<Probe />)
            expect(observed).toEqual([expected])
        }
    )

    it('keeps a missing layout context unknown through hydration, then follows a nullable live route', async () => {
        mockSegments = null
        mockPathname = null
        container.innerHTML = renderToString(<Probe />)
        observed.length = 0
        mockPathname = '/home/'
        const onRecoverableError = jest.fn()
        await act(async () => {
            root = hydrateRoot(container, <Probe />, { onRecoverableError })
        })
        expect(observed[0]).toBeNull()
        expect(observed.at(-1)).toBe('/home/')
        mockPathname = null
        await act(async () => root!.render(<Probe />))
        expect(observed.at(-1)).toBeNull()
        expect(onRecoverableError).not.toHaveBeenCalled()
    })

    it('uses the live pathname on ordinary client rendering and route changes', () => {
        mockPathname = '/setup/'
        const { result, rerender } = renderHook(useHydrationPathname)
        expect(result.current).toBe('/setup/')
        mockPathname = '/home/'
        rerender()
        expect(result.current).toBe('/home/')
    })
})
