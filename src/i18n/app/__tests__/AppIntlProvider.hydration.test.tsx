import React from 'react'
import { act } from '@testing-library/react'
import { hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { AppIntlProvider } from '@/i18n/app/AppIntlProvider'

jest.mock('react-dom/server', () => jest.requireActual('react-dom/server.node'))
let mockPathname = '/'
let mockSegments: string[] = []
let mockLocaleReady: Promise<string>
jest.mock('next/navigation', () => ({
    usePathname: () => mockPathname,
    useSelectedLayoutSegments: () => mockSegments,
}))
jest.mock('../locale-store', () => ({
    currentAppLocale: () => null,
    emitDeviceContextToAnalytics: jest.fn(async () => {}),
    emitLocaleToAnalytics: jest.fn(),
    localeReady: () => mockLocaleReady,
    markLocaleApplied: jest.fn(),
    persistLocale: jest.fn(),
}))
jest.mock('../../htmlLangClaim', () => ({
    isHtmlLangClaimed: () => false,
    setHtmlLangReleaseListener: jest.fn(),
}))

function Tree() {
    return (
        <section>
            <AppIntlProvider>
                <span data-testid="app-content">Setup content</span>
            </AppIntlProvider>
            <p data-testid="sentinel">Page content</p>
        </section>
    )
}

describe('native AppIntlProvider deep-link hydration', () => {
    let container: HTMLDivElement
    let root: Root | undefined
    let capacitorDescriptor: PropertyDescriptor | undefined
    let previousNativeBuild: string | undefined
    let resolveLocale: (locale: string) => void

    beforeEach(() => {
        previousNativeBuild = process.env.NEXT_PUBLIC_CAPACITOR_BUILD
        process.env.NEXT_PUBLIC_CAPACITOR_BUILD = 'true'
        capacitorDescriptor = Object.getOwnPropertyDescriptor(window, 'Capacitor')
        Object.defineProperty(window, 'Capacitor', { configurable: true, writable: true, value: undefined })
        mockPathname = '/'
        mockSegments = []
        mockLocaleReady = new Promise((resolve) => {
            resolveLocale = resolve
        })
        container = document.createElement('div')
        document.body.appendChild(container)
    })

    afterEach(() => {
        if (root) act(() => root!.unmount())
        root = undefined
        container.remove()
        if (capacitorDescriptor) Object.defineProperty(window, 'Capacitor', capacitorDescriptor)
        else Reflect.deleteProperty(window, 'Capacitor')
        if (previousNativeBuild === undefined) delete process.env.NEXT_PUBLIC_CAPACITOR_BUILD
        else process.env.NEXT_PUBLIC_CAPACITOR_BUILD = previousNativeBuild
    })

    it.each(
        ['ios', 'android'].flatMap((platform) =>
            ['true', 'false'].flatMap((buildFlag) =>
                [
                    '/',
                    '/setup',
                    '/setup/',
                    '/home',
                    '/home/',
                    '/receipt/',
                    '/card/',
                    '/qr-pay/',
                    '/profile/',
                    '/add-money/',
                    '/invite/',
                ].map((pathname) => [platform, buildFlag, pathname])
            )
        )
    )(
        'hydrates root export HTML at %s build=%s %s without replacing the page',
        async (platform, buildFlag, pathname) => {
            process.env.NEXT_PUBLIC_CAPACITOR_BUILD = buildFlag
            container.innerHTML = renderToString(<Tree />)
            expect(container.querySelector('[data-testid="app-content"]')).toHaveTextContent('Setup content')
            const appContent = container.querySelector('[data-testid="app-content"]')
            const sentinel = container.querySelector('[data-testid="sentinel"]')
            mockPathname = pathname
            Object.defineProperty(window, 'Capacitor', {
                configurable: true,
                writable: true,
                value: { isNativePlatform: () => true, getPlatform: () => platform },
            })
            const onRecoverableError = jest.fn()
            await act(async () => {
                root = hydrateRoot(container, <Tree />, { onRecoverableError })
            })
            expect(onRecoverableError).not.toHaveBeenCalled()
            expect(container.querySelector('[data-testid="sentinel"]')).toBe(sentinel)
            expect(container.querySelector('[data-testid="app-content"]')).toHaveTextContent('Setup content')
            expect(container.querySelector('[data-testid="app-content"]')).toBe(appContent)
            await act(async () => resolveLocale('en'))
            expect(container.querySelector('[data-testid="app-content"]')).toHaveTextContent('Setup content')
            expect(container.querySelector('[data-testid="app-content"]')).toBe(appContent)
            expect(container.querySelector('[data-testid="sentinel"]')).toBe(sentinel)
            expect(onRecoverableError).not.toHaveBeenCalled()
        }
    )

    it('hydrates the normal web setup page at the same pathname', async () => {
        delete process.env.NEXT_PUBLIC_CAPACITOR_BUILD
        mockPathname = '/setup'
        mockSegments = ['(setup)', 'setup']
        container.innerHTML = renderToString(<Tree />)
        expect(container.querySelector('[data-testid="app-content"]')).toBeNull()
        const sentinel = container.querySelector('[data-testid="sentinel"]')
        const onRecoverableError = jest.fn()
        await act(async () => {
            root = hydrateRoot(container, <Tree />, { onRecoverableError })
        })
        expect(onRecoverableError).not.toHaveBeenCalled()
        expect(container.querySelector('[data-testid="sentinel"]')).toBe(sentinel)
        expect(container.querySelector('[data-testid="app-content"]')).toBeNull()
        await act(async () => resolveLocale('en'))
        expect(container.querySelector('[data-testid="app-content"]')).toHaveTextContent('Setup content')
        expect(container.querySelector('[data-testid="sentinel"]')).toBe(sentinel)
        expect(onRecoverableError).not.toHaveBeenCalled()
    })
})
