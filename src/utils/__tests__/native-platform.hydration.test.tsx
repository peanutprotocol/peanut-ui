import React from 'react'
import { act, waitFor } from '@testing-library/react'
import { hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { useNativePlatform } from '@/utils/native-platform'
import { getPlatform, isCapacitor, isIOSNative, isAndroidNative } from '@/utils/capacitor'

jest.mock('react-dom/server', () => jest.requireActual('react-dom/server.node'))

const serverSnapshot = {
    isCapacitor: false,
    isNativeBridge: false,
    platform: 'web',
    isIOSNative: false,
    isAndroidNative: false,
    isAndroidNativeBridge: false,
    isHydrated: false,
}

function Probe() {
    const snapshot = useNativePlatform()
    return <output data-testid="platform">{JSON.stringify(snapshot)}</output>
}

describe('native platform public hydration contract', () => {
    let container: HTMLDivElement
    let root: Root | undefined
    let previousBridge: PropertyDescriptor | undefined

    beforeEach(() => {
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

    const read = (container: HTMLElement) => JSON.parse(container.querySelector('output')!.textContent!)

    it.each(['ios', 'android'] as const)(
        'hydrates web HTML into %s without replacing the DOM, including a repeat mount',
        async (platform) => {
            for (let mount = 0; mount < 2; mount += 1) {
                Reflect.deleteProperty(window, 'Capacitor')
                container.innerHTML = renderToString(<Probe />)
                const serverNode = container.querySelector('output')
                expect(read(container)).toEqual(serverSnapshot)
                window.Capacitor = { getPlatform: () => platform, isNativePlatform: () => true }
                // Imperative callers must still see the bridge synchronously.
                expect(isCapacitor()).toBe(true)
                expect(getPlatform()).toBe(`${platform}-native`)
                expect(isIOSNative()).toBe(platform === 'ios')
                expect(isAndroidNative()).toBe(platform === 'android')
                const onRecoverableError = jest.fn()
                await act(async () => {
                    root = hydrateRoot(container, <Probe />, { onRecoverableError })
                })
                await waitFor(() =>
                    expect(read(container)).toEqual({
                        isCapacitor: true,
                        isNativeBridge: true,
                        platform: `${platform}-native`,
                        isIOSNative: platform === 'ios',
                        isAndroidNative: platform === 'android',
                        isAndroidNativeBridge: platform === 'android',
                        isHydrated: true,
                    })
                )
                expect(onRecoverableError).not.toHaveBeenCalled()
                expect(container.querySelector('output')).toBe(serverNode)
                act(() => root!.unmount())
                root = undefined
            }
        }
    )

    it('keeps the server snapshot neutral even if a bridge exists during server rendering', () => {
        window.Capacitor = { getPlatform: () => 'ios', isNativePlatform: () => true }
        container.innerHTML = renderToString(<Probe />)
        expect(read(container)).toEqual(serverSnapshot)
    })

    it.each([undefined, {}])('hydrates a web or incomplete bridge safely: %p', async (bridge) => {
        container.innerHTML = renderToString(<Probe />)
        const serverNode = container.querySelector('output')
        Object.defineProperty(window, 'Capacitor', { configurable: true, writable: true, value: bridge })
        const onRecoverableError = jest.fn()
        await act(async () => {
            root = hydrateRoot(container, <Probe />, { onRecoverableError })
        })
        await waitFor(() => expect(read(container)).toEqual({ ...serverSnapshot, isHydrated: true }))
        expect(onRecoverableError).not.toHaveBeenCalled()
        expect(container.querySelector('output')).toBe(serverNode)
    })
})
