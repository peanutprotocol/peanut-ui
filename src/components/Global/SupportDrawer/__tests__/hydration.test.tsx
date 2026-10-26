import React from 'react'
import { act } from '@testing-library/react'
import { hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import SupportDrawer from '@/components/Global/SupportDrawer'
import { IntlWrapper } from '@/test-utils/intl'

jest.mock('react-dom/server', () => jest.requireActual('react-dom/server.node'))

const mockModal = { isSupportModalOpen: false }
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ ...mockModal, setIsSupportModalOpen: jest.fn(), supportPrefilledMessage: undefined }),
}))
jest.mock('@/services/notifications', () => ({
    notificationsApi: { markAllRead: jest.fn(async () => ({ ok: true })) },
}))
jest.mock('@/hooks/useCrispUserData', () => ({ useCrispUserData: () => ({}) }))
jest.mock('@/hooks/useCrispTokenId', () => ({ useCrispTokenId: () => undefined }))
jest.mock('../../Loading', () => ({ __esModule: true, default: () => <span>Loading</span> }))
jest.mock('@/utils/camera-permission', () => ({ ensureNativeCameraPermission: jest.fn(async () => true) }))
jest.mock('@capgo/capacitor-crisp', () => ({
    CapacitorCrisp: {
        configure: jest.fn(),
        setUser: jest.fn(),
        setTokenID: jest.fn(),
        setString: jest.fn(),
        setSegment: jest.fn(),
        openMessenger: jest.fn(),
    },
}))

function Tree() {
    return (
        <IntlWrapper>
            <section data-testid="support-container">
                <SupportDrawer />
            </section>
            <p data-testid="sentinel">Page content</p>
        </IntlWrapper>
    )
}

describe('SupportDrawer hydration', () => {
    let container: HTMLDivElement
    let root: Root | undefined
    let capacitorDescriptor: PropertyDescriptor | undefined

    beforeEach(() => {
        capacitorDescriptor = Object.getOwnPropertyDescriptor(window, 'Capacitor')
        Object.defineProperty(window, 'Capacitor', { configurable: true, writable: true, value: undefined })
        mockModal.isSupportModalOpen = false
        container = document.createElement('div')
        document.body.appendChild(container)
    })

    afterEach(() => {
        if (root) act(() => root!.unmount())
        root = undefined
        container.remove()
        if (capacitorDescriptor) Object.defineProperty(window, 'Capacitor', capacitorDescriptor)
        else Reflect.deleteProperty(window, 'Capacitor')
    })

    it.each(['ios', 'android'])('hydrates closed web HTML on %s without replacing page content', async (platform) => {
        for (let cycle = 0; cycle < 2; cycle++) {
            Object.defineProperty(window, 'Capacitor', { configurable: true, writable: true, value: undefined })
            container.innerHTML = renderToString(<Tree />)
            const sentinel = container.querySelector('[data-testid="sentinel"]')
            const support = container.querySelector('[data-testid="support-container"]')!
            expect(support.childElementCount).toBeGreaterThan(0)
            expect(container.querySelector('iframe')).toBeNull()
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
            expect(container.querySelector('[data-testid="support-container"]')).toBe(support)
            expect(support).toBeEmptyDOMElement()
            expect(container.querySelector('[role="dialog"], iframe')).toBeNull()
            act(() => root!.unmount())
            root = undefined
        }
    })

    it('preserves the closed web drawer through hydration and loads the iframe when opened', async () => {
        container.innerHTML = renderToString(<Tree />)
        const support = container.querySelector('[data-testid="support-container"]')!
        const drawer = support.firstElementChild
        expect(drawer).not.toBeNull()
        expect(container.querySelector('iframe')).toBeNull()
        const onRecoverableError = jest.fn()
        await act(async () => {
            root = hydrateRoot(container, <Tree />, { onRecoverableError })
        })

        expect(onRecoverableError).not.toHaveBeenCalled()
        expect(support.firstElementChild).toBe(drawer)
        expect(drawer).toHaveAttribute('aria-hidden', 'true')
        expect(support.querySelector('[role="dialog"]')).toHaveAttribute('aria-modal', 'false')
        expect(container.querySelector('iframe')).toBeNull()
        mockModal.isSupportModalOpen = true
        await act(async () => root!.render(<Tree />))
        expect(container.querySelector('iframe[title="Support Chat"]')).toHaveAttribute('src', '/crisp-proxy')
    })
})
