import React, { useEffect, useState } from 'react'
import { act } from '@testing-library/react'
import { hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { IntlWrapper } from '@/test-utils/intl'
import { SetupWrapper } from '@/components/Setup/components/SetupWrapper'

jest.mock('react-dom/server', () => jest.requireActual('react-dom/server.node'))
let mockReducedMotion = false
const mockY: Array<string | number> = []
const mockMount = jest.fn()
jest.mock('@/i18n/app/locale-context', () => ({ useAppLocale: () => ({ locale: 'en', setLocale: jest.fn() }) }))
jest.mock('@/hooks/useKeepWebBypass', () => ({ useKeepWebBypass: () => false }))
jest.mock('@/hooks/useMigrationFlag', () => ({ useMigrationFlag: () => false }))
jest.mock('@capacitor/status-bar', () => ({ StatusBar: { setBackgroundColor: jest.fn() } }))
jest.mock('@/components/0_Bruddle/CloudsBackground', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/PeanutMascot', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Setup/components/OnboardingAnimation', () => ({ __esModule: true, default: () => null }))
jest.mock('next/image', () => ({ __esModule: true, default: () => null }))
jest.mock('framer-motion', () => ({
    useReducedMotion: () => mockReducedMotion,
    useIsPresent: () => true,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
        div: function MockMotion({
            children,
            className,
            animate,
        }: {
            children?: React.ReactNode
            className?: string
            animate?: { y?: string | number | Array<string | number> }
        }) {
            if (animate?.y !== undefined) mockY.push(...(Array.isArray(animate.y) ? animate.y : [animate.y]))
            return (
                <div className={className} data-animate-y={animate?.y}>
                    {children}
                </div>
            )
        },
    },
}))

function StatefulChild() {
    const [count, setCount] = useState(0)
    useEffect(() => {
        mockMount()
    }, [])
    return (
        <button data-testid="step-child" onClick={() => setCount((value) => value + 1)}>
            {count}
        </button>
    )
}
function Tree() {
    return (
        <IntlWrapper>
            <SetupWrapper layoutType="signup" screenId="landing" step={0} image={{ pose: 'waving-chill' }}>
                <StatefulChild />
            </SetupWrapper>
        </IntlWrapper>
    )
}

describe('setup landing slide hydration contract', () => {
    let container: HTMLDivElement
    let root: Root | undefined
    let originalMatchMedia: typeof window.matchMedia
    beforeEach(() => {
        jest.useFakeTimers()
        jest.clearAllMocks()
        mockY.length = 0
        mockReducedMotion = false
        originalMatchMedia = window.matchMedia
        window.matchMedia = (query) => ({ ...originalMatchMedia(query), matches: query === '(max-width: 767px)' })
        container = document.createElement('div')
        document.body.appendChild(container)
    })
    afterEach(() => {
        if (root) act(() => root!.unmount())
        root = undefined
        container.remove()
        window.matchMedia = originalMatchMedia
        jest.useRealTimers()
    })

    it('hydrates the resting server snapshot, then performs mobile entry without resetting child state', async () => {
        container.innerHTML = renderToString(<Tree />)
        expect(mockY).not.toContain('100%')
        const child = container.querySelector('[data-testid="step-child"]')!
        mockY.length = 0
        const onRecoverableError = jest.fn()
        await act(async () => {
            root = hydrateRoot(container, <Tree />, { onRecoverableError })
        })
        act(() => {
            child.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        })
        await act(async () => {
            jest.advanceTimersByTime(500)
        })
        const entry = mockY.indexOf('100%')
        expect(entry).toBeGreaterThanOrEqual(0)
        expect(mockY.slice(entry + 1).some((value) => value === 0 || value === '0%' || value === '0px')).toBe(true)
        expect(container.querySelector('[data-testid="step-child"]')).toBe(child)
        expect(child).toHaveTextContent('1')
        expect(mockMount).toHaveBeenCalledTimes(1)
        expect(onRecoverableError).not.toHaveBeenCalled()
    })

    it.each(['desktop', 'reduced-motion'])('skips the landing rise for %s while preserving hydration', async (mode) => {
        if (mode === 'desktop') window.matchMedia = originalMatchMedia
        else mockReducedMotion = true
        container.innerHTML = renderToString(<Tree />)
        const child = container.querySelector('[data-testid="step-child"]')
        const onRecoverableError = jest.fn()
        await act(async () => {
            root = hydrateRoot(container, <Tree />, { onRecoverableError })
        })
        await act(async () => {
            jest.advanceTimersByTime(500)
        })
        expect(mockY).not.toContain('100%')
        expect(container.querySelector('[data-testid="step-child"]')).toBe(child)
        expect(mockMount).toHaveBeenCalledTimes(1)
        expect(onRecoverableError).not.toHaveBeenCalled()
    })
})
