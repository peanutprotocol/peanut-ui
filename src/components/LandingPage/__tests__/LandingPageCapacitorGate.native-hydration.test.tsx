import React, { StrictMode, useEffect, useLayoutEffect, useState } from 'react'
import { act, waitFor } from '@testing-library/react'
import { hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { LandingPageCapacitorGate } from '@/components/LandingPage/LandingPageCapacitorGate'

jest.mock('react-dom/server', () => jest.requireActual('react-dom/server.node'))
const mockHasNativeSession = jest.fn<Promise<boolean>, []>()
const mockNavigate = jest.fn()
const mockWebRender = jest.fn()
const mockWebEffect = jest.fn()
jest.mock('@/utils/auth-token', () => ({ hasNativeSession: () => mockHasNativeSession() }))
jest.mock('@/utils/deep-link-state', () => ({ hasDeepLinkNavigated: () => false }))
jest.mock('@/utils/demo', () => ({ isDemoMode: () => false }))
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace: mockNavigate, push: mockNavigate }) }))

function WebOnlyChild() {
    mockWebRender()
    useEffect(() => {
        mockWebEffect()
    }, [])
    return <main data-testid="web-content">Welcome to Peanut</main>
}
function Tree({ earlyUpdate = false }: { earlyUpdate?: boolean }) {
    const [tick, setTick] = useState(0)
    useLayoutEffect(() => {
        if (earlyUpdate) setTick(1)
    }, [earlyUpdate])
    return (
        <section data-parent-update={tick}>
            <LandingPageCapacitorGate>
                <WebOnlyChild />
            </LandingPageCapacitorGate>
            <aside data-testid="outer-sentinel">Outside the landing gate</aside>
        </section>
    )
}

describe('landing native hydration excludes web startup effects', () => {
    let container: HTMLDivElement
    let root: Root | undefined
    let previousBridge: PropertyDescriptor | undefined
    let previousLocation: PropertyDescriptor | undefined
    beforeEach(() => {
        jest.clearAllMocks()
        mockHasNativeSession.mockResolvedValue(true)
        previousBridge = Object.getOwnPropertyDescriptor(window, 'Capacitor')
        previousLocation = Object.getOwnPropertyDescriptor(window, 'location')
        Reflect.deleteProperty(window, 'Capacitor')
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: {
                ...window.location,
                replace: mockNavigate,
                assign: mockNavigate,
                get href() {
                    return 'http://localhost/'
                },
                set href(url: string) {
                    mockNavigate(url)
                },
            },
        })
        container = document.createElement('div')
        document.body.appendChild(container)
    })
    afterEach(() => {
        if (root) act(() => root!.unmount())
        root = undefined
        container.remove()
        if (previousBridge) Object.defineProperty(window, 'Capacitor', previousBridge)
        else Reflect.deleteProperty(window, 'Capacitor')
        if (previousLocation) Object.defineProperty(window, 'location', previousLocation)
    })

    it.each([
        ['ios', false],
        ['android', false],
        ['ios', true],
        ['android', true],
    ] as const)(
        'preserves web SSR while hydrating %s strict=%s without any native web child startup, including repeat mounts',
        async (platform, strict) => {
            for (let mount = 0; mount < 2; mount += 1) {
                Reflect.deleteProperty(window, 'Capacitor')
                const tree = strict ? (
                    <StrictMode>
                        <Tree earlyUpdate />
                    </StrictMode>
                ) : (
                    <Tree earlyUpdate />
                )
                container.innerHTML = renderToString(tree)
                expect(container.querySelector('[data-testid="web-content"]')).toHaveTextContent('Welcome to Peanut')
                const sentinel = container.querySelector('[data-testid="outer-sentinel"]')
                // Server content is required for web SEO; native must leave the effect-bearing subtree inert.
                mockWebRender.mockClear()
                mockWebEffect.mockClear()
                mockNavigate.mockClear()
                window.Capacitor = { getPlatform: () => platform, isNativePlatform: () => true }
                const onRecoverableError = jest.fn()
                await act(async () => {
                    root = hydrateRoot(container, tree, { onRecoverableError })
                })
                await waitFor(() => expect(mockNavigate).toHaveBeenCalled())
                expect(mockHasNativeSession).toHaveBeenCalled()
                expect(onRecoverableError).not.toHaveBeenCalled()
                expect(mockWebRender).not.toHaveBeenCalled()
                expect(mockWebEffect).not.toHaveBeenCalled()
                expect(container.querySelector('[data-testid="outer-sentinel"]')).toBe(sentinel)
                expect(container.querySelector('section')).toHaveAttribute('data-parent-update', '1')
                act(() => root!.unmount())
                root = undefined
            }
        }
    )

    it('eventually mounts web content without a native session lookup or redirect', async () => {
        container.innerHTML = renderToString(<Tree />)
        const webContent = container.querySelector('[data-testid="web-content"]')
        const sentinel = container.querySelector('[data-testid="outer-sentinel"]')
        expect(webContent).toHaveTextContent('Welcome to Peanut')
        mockWebRender.mockClear()
        const onRecoverableError = jest.fn()
        await act(async () => {
            root = hydrateRoot(container, <Tree />, { onRecoverableError })
        })
        await waitFor(() => expect(mockWebEffect).toHaveBeenCalledTimes(1))
        expect(container.querySelector('[data-testid="web-content"]')).toHaveTextContent('Welcome to Peanut')
        expect(container.querySelector('[data-testid="web-content"]')).toBe(webContent)
        expect(container.querySelector('[data-testid="outer-sentinel"]')).toBe(sentinel)
        expect(onRecoverableError).not.toHaveBeenCalled()
        expect(mockHasNativeSession).not.toHaveBeenCalled()
        expect(mockNavigate).not.toHaveBeenCalled()
    })
})
