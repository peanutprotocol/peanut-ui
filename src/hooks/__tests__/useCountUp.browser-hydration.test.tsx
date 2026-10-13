import React from 'react'
import { act } from '@testing-library/react'
import { hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { useCountUp } from '@/hooks/useCountUp'
import { frameData, frameSteps, MotionGlobalConfig, time } from 'framer-motion'

jest.mock('react-dom/server', () => jest.requireActual('react-dom/server.node'))

const observed: number[] = []
async function finishAnimation() {
    for (let frame = 0; frame < 30; frame += 1) {
        await act(async () => {
            frameData.delta = 1000 / 60
            frameData.timestamp += frameData.delta
            frameData.isProcessing = true
            time.set(frameData.timestamp)
            for (const step of Object.values(frameSteps)) step.process(frameData)
            frameData.isProcessing = false
        })
    }
}
function Probe({ target = 100, enabled = true }: { target?: number; enabled?: boolean }) {
    const count = useCountUp(target, { storageKey: 'hydration-test', duration: 0.1, enabled })
    observed.push(count)
    return <output>{count}</output>
}

describe('stored counter hydration contract', () => {
    let container: HTMLDivElement
    let root: Root | undefined
    beforeEach(() => {
        MotionGlobalConfig.useManualTiming = true
        frameData.timestamp = 0
        time.set(0)
        localStorage.clear()
        observed.length = 0
        container = document.createElement('div')
        document.body.appendChild(container)
    })
    afterEach(() => {
        if (root) act(() => root!.unmount())
        root = undefined
        container.remove()
        jest.restoreAllMocks()
        MotionGlobalConfig.useManualTiming = false
        localStorage.clear()
    })

    it('renders the target on the server and first hydration, then animates from persisted previous value', async () => {
        localStorage.setItem('peanut_points_hydration-test', '20')
        container.innerHTML = renderToString(<Probe />)
        expect(container).toHaveTextContent('100')
        const node = container.querySelector('output')
        observed.length = 0
        const onRecoverableError = jest.fn()
        await act(async () => {
            root = hydrateRoot(container, <Probe />, { onRecoverableError })
        })
        expect(observed[0]).toBe(100)
        expect(observed).toContain(20)
        await finishAnimation()
        expect(container).toHaveTextContent('100')
        expect(container.querySelector('output')).toBe(node)
        expect(onRecoverableError).not.toHaveBeenCalled()
    })

    it('keeps persisted previous points while disabled and uses them when real target data arrives', async () => {
        localStorage.setItem('peanut_points_hydration-test', '20')
        container.innerHTML = renderToString(<Probe target={0} enabled={false} />)
        const onRecoverableError = jest.fn()
        await act(async () => {
            root = hydrateRoot(container, <Probe target={0} enabled={false} />, { onRecoverableError })
        })
        expect(localStorage.getItem('peanut_points_hydration-test')).toBe('20')
        observed.length = 0
        await act(async () => {
            root!.render(<Probe target={100} enabled />)
        })
        expect(observed).toContain(20)
        await finishAnimation()
        expect(container).toHaveTextContent('100')
        expect(onRecoverableError).not.toHaveBeenCalled()
    })

    it.each(['NaN', 'Infinity', '-1', '9007199254740992', '20oops', '1.5', ''])(
        'ignores malformed or unsafe stored points %p',
        async (stored) => {
            localStorage.setItem('peanut_points_hydration-test', stored)
            container.innerHTML = renderToString(<Probe />)
            const node = container.querySelector('output')
            observed.length = 0
            const onRecoverableError = jest.fn()
            await act(async () => {
                root = hydrateRoot(container, <Probe />, { onRecoverableError })
            })
            await finishAnimation()
            expect(observed.every((value) => value === 100)).toBe(true)
            expect(container).toHaveTextContent('100')
            expect(container.querySelector('output')).toBe(node)
            expect(onRecoverableError).not.toHaveBeenCalled()
        }
    )

    it('falls back to the target when storage reads and writes throw', async () => {
        jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('storage unavailable')
        })
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('storage unavailable')
        })
        container.innerHTML = renderToString(<Probe />)
        const onRecoverableError = jest.fn()
        await act(async () => {
            root = hydrateRoot(container, <Probe />, { onRecoverableError })
        })
        await finishAnimation()
        expect(container).toHaveTextContent('100')
        expect(onRecoverableError).not.toHaveBeenCalled()
    })
})
