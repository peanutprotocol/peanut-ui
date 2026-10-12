import React from 'react'
import { act, waitFor } from '@testing-library/react'
import { hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import CloudsBackground from '@/components/0_Bruddle/CloudsBackground'

jest.mock('react-dom/server', () => jest.requireActual('react-dom/server.node'))
jest.mock('next/image', () => ({ __esModule: true, default: ({ alt }: { alt?: string }) => <img alt={alt ?? ''} /> }))

describe('cloud background viewport hydration contract', () => {
    let container: HTMLDivElement
    let root: Root | undefined
    let width: PropertyDescriptor | undefined
    beforeEach(() => {
        width = Object.getOwnPropertyDescriptor(window, 'innerWidth')
        Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 390 })
        container = document.createElement('div')
        document.body.appendChild(container)
    })
    afterEach(() => {
        if (root) act(() => root!.unmount())
        root = undefined
        container.remove()
        if (width) Object.defineProperty(window, 'innerWidth', width)
    })

    it('uses the 1200px desktop server snapshot, hydrates mobile, then tracks resize without replacing the background', async () => {
        container.innerHTML = renderToString(<CloudsBackground />)
        const background = container.firstElementChild
        const firstCloud = () => container.querySelector<HTMLElement>('.cloud-drift')!
        expect(container.querySelectorAll('.cloud-drift')).toHaveLength(6)
        expect(firstCloud().style.getPropertyValue('--cloud-from')).toBe('1200px')
        expect(firstCloud().style.getPropertyValue('--cloud-to')).toBe('-210px')
        const onRecoverableError = jest.fn()
        await act(async () => {
            root = hydrateRoot(container, <CloudsBackground />, { onRecoverableError })
        })
        await waitFor(() => expect(container.querySelectorAll('.cloud-drift')).toHaveLength(4))
        expect(firstCloud().style.getPropertyValue('--cloud-from')).toBe('390px')
        expect(container.firstElementChild).toBe(background)
        expect(onRecoverableError).not.toHaveBeenCalled()
        await act(async () => {
            window.innerWidth = 1440
            window.dispatchEvent(new Event('resize'))
        })
        await waitFor(() => expect(container.querySelectorAll('.cloud-drift')).toHaveLength(6))
        expect(firstCloud().style.getPropertyValue('--cloud-from')).toBe('1440px')
        expect(container.firstElementChild).toBe(background)
    })
})
