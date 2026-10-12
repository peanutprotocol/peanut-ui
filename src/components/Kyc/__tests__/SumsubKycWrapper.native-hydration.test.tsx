import React, { useEffect } from 'react'
import { act, waitFor } from '@testing-library/react'
import { hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { IntlWrapper } from '@/test-utils/intl'
import { SumsubKycWrapper } from '@/components/Kyc/SumsubKycWrapper'

jest.mock('react-dom/server', () => jest.requireActual('react-dom/server.node'))
const mockWebRender = jest.fn()
const mockWebEffect = jest.fn()
const mockNativeRender = jest.fn()
const mockNativeEffect = jest.fn()
jest.mock('@/components/Kyc/SumsubWebSdkModal', () => ({
    SumsubWebSdkModal: function MockWebSdk() {
        mockWebRender()
        useEffect(() => {
            mockWebEffect()
        }, [])
        return <div data-testid="web-sdk" />
    },
}))
jest.mock('@/components/Kyc/SumsubNativeSdk', () => ({
    SumsubNativeSdk: function MockNativeSdk() {
        mockNativeRender()
        useEffect(() => {
            mockNativeEffect()
        }, [])
        return <div data-testid="native-sdk" />
    },
}))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { user: { email: 'user@example.com' } } }) }))

const props = {
    visible: true,
    accessToken: 'test-token',
    onClose: jest.fn(),
    onComplete: jest.fn(),
    onRefreshToken: jest.fn().mockResolvedValue('test-token'),
}
function Tree() {
    return (
        <IntlWrapper>
            <SumsubKycWrapper {...props} />
        </IntlWrapper>
    )
}

describe('SumsubKycWrapper native hydration driver isolation', () => {
    let container: HTMLDivElement
    let root: Root | undefined
    let previousBridge: PropertyDescriptor | undefined
    beforeEach(() => {
        jest.clearAllMocks()
        previousBridge = Object.getOwnPropertyDescriptor(window, 'Capacitor')
        Reflect.deleteProperty(window, 'Capacitor')
        container = document.createElement('div')
        document.body.appendChild(container)
    })
    afterEach(() => {
        if (root) act(() => root!.unmount())
        root = undefined
        container.remove()
        if (previousBridge) Object.defineProperty(window, 'Capacitor', previousBridge)
        else Reflect.deleteProperty(window, 'Capacitor')
    })

    it.each(['ios', 'android'] as const)(
        'never starts even a transient WebSDK child while hydrating %s',
        async (platform) => {
            container.innerHTML = renderToString(<Tree />)
            mockWebRender.mockClear()
            mockNativeRender.mockClear()
            window.Capacitor = { getPlatform: () => platform, isNativePlatform: () => true }
            const onRecoverableError = jest.fn()
            await act(async () => {
                root = hydrateRoot(container, <Tree />, { onRecoverableError })
            })
            await waitFor(() => expect(container.querySelector('[data-testid="native-sdk"]')).not.toBeNull())
            expect(onRecoverableError).not.toHaveBeenCalled()
            expect(mockWebRender).not.toHaveBeenCalled()
            expect(mockWebEffect).not.toHaveBeenCalled()
            expect(mockNativeEffect).toHaveBeenCalledTimes(1)
            expect(container.querySelector('[data-testid="web-sdk"]')).toBeNull()
        }
    )

    it('eventually starts only the WebSDK in a normal web hydration', async () => {
        container.innerHTML = renderToString(<Tree />)
        mockWebRender.mockClear()
        const onRecoverableError = jest.fn()
        await act(async () => {
            root = hydrateRoot(container, <Tree />, { onRecoverableError })
        })
        await waitFor(() => expect(mockWebEffect).toHaveBeenCalledTimes(1))
        expect(container.querySelector('[data-testid="web-sdk"]')).not.toBeNull()
        expect(mockNativeRender).not.toHaveBeenCalled()
        expect(mockNativeEffect).not.toHaveBeenCalled()
        expect(onRecoverableError).not.toHaveBeenCalled()
    })
})
