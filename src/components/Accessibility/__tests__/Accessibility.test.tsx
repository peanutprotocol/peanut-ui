import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import en from '@/i18n/app/messages/en.json'
import { useAccessibility, useReducedMotion } from '@/hooks/useAccessibility'
import {
    ACCESSIBILITY_STORAGE_KEY,
    updateAccessibilityPreferences,
    parseAccessibilityPreferences,
    DEFAULT_ACCESSIBILITY,
} from '@/utils/accessibility-preferences'
import { AccessibilityProvider } from '../AccessibilityProvider'
import SlideToConfirm from '@/components/0_Bruddle/SlideToConfirm'
import { HoldToClaimButton } from '@/components/Global/HoldToClaimButton'
import { Button } from '@/components/0_Bruddle/Button'
import ActionModal from '@/components/Global/ActionModal'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { AccessibilityView } from '@/components/Settings/AccessibilityView'

jest.mock('@/hooks/useSafeBack', () => ({ useSafeBack: () => jest.fn() }))
jest.mock('@/components/Global/NavHeader', () => ({
    __esModule: true,
    default: ({ title }: { title: string }) => <h1>{title}</h1>,
}))
jest.mock('@/context/ModalsContext', () => ({ useModalsContext: () => ({ setIsSupportModalOpen: jest.fn() }) }))
jest.mock('@/hooks/useAppHaptic', () => ({ useAppHaptic: () => ({ triggerHaptic: jest.fn() }) }))
jest.mock('@/utils/haptics', () => ({ cancelHaptic: jest.fn(), vibrateHaptic: jest.fn() }))

const wrap = (children: React.ReactNode) => (
    <NextIntlClientProvider locale="en" messages={en}>
        <AccessibilityProvider>{children}</AccessibilityProvider>
    </NextIntlClientProvider>
)

beforeEach(() => {
    localStorage.clear()
    act(() => updateAccessibilityPreferences(DEFAULT_ACCESSIBILITY))
})

it('validates saved preferences and tolerates corrupt or partial storage', () => {
    expect(parseAccessibilityPreferences('{broken')).toEqual(DEFAULT_ACCESSIBILITY)
    expect(parseAccessibilityPreferences('{"largerText":"false","motion":"invalid"}')).toEqual(DEFAULT_ACCESSIBILITY)
    expect(parseAccessibilityPreferences('{"largerText":true}').largerText).toBe(true)
})

it('settings expose named switches, update every consumer and persist through remount', () => {
    const first = render(wrap(<AccessibilityView />))
    fireEvent.click(screen.getByRole('switch', { name: 'Larger text' }))
    fireEvent.click(screen.getByRole('switch', { name: 'Increase contrast' }))
    fireEvent.change(screen.getByRole('combobox', { name: 'Reduce motion' }), { target: { value: 'on' } })
    expect(document.documentElement).toHaveAttribute('data-larger-text', 'true')
    expect(document.documentElement).toHaveAttribute('data-high-contrast', 'true')
    expect(document.documentElement).toHaveAttribute('data-reduced-motion', 'true')
    expect(JSON.parse(localStorage.getItem(ACCESSIBILITY_STORAGE_KEY)!)).toMatchObject({
        largerText: true,
        highContrast: true,
        motion: 'on',
    })
    first.unmount()
    render(wrap(<AccessibilityView />))
    expect(screen.getByRole('switch', { name: 'Larger text' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('combobox', { name: 'Reduce motion' })).toHaveValue('on')
})

it('tracks live OS changes and lets an explicit Off override them', () => {
    const original = window.matchMedia
    let matches = false
    const listeners = new Set<() => void>()
    window.matchMedia = jest.fn().mockImplementation(() => ({
        get matches() {
            return matches
        },
        addEventListener: (_: string, cb: () => void) => listeners.add(cb),
        removeEventListener: (_: string, cb: () => void) => listeners.delete(cb),
    }))
    const { result, unmount } = renderHook(() => useReducedMotion())
    expect(result.current).toBe(false)
    act(() => {
        matches = true
        listeners.forEach((cb) => cb())
    })
    expect(result.current).toBe(true)
    act(() => updateAccessibilityPreferences({ motion: 'off' }))
    expect(result.current).toBe(false)
    unmount()
    window.matchMedia = original
})

it('synchronizes a preference change from another tab', () => {
    const { result } = renderHook(() => useAccessibility())
    act(() => {
        localStorage.setItem(ACCESSIBILITY_STORAGE_KEY, JSON.stringify({ largerText: true }))
        window.dispatchEvent(new StorageEvent('storage', { key: ACCESSIBILITY_STORAGE_KEY }))
    })
    expect(result.current.largerText).toBe(true)
})

it('keeps preferences usable when storage is unavailable', () => {
    const get = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('unavailable')
    })
    const set = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('unavailable')
    })
    const { result } = renderHook(() => useAccessibility())
    act(() => updateAccessibilityPreferences({ largerText: true }))
    expect(result.current.largerText).toBe(true)
    expect(document.documentElement).toHaveAttribute('data-larger-text', 'true')
    get.mockRestore()
    set.mockRestore()
})

it.each([false, true])(
    'slider pointer taps offer confirmation only in simplified mode (%s)',
    (simplifiedConfirmations) => {
        updateAccessibilityPreferences({ simplifiedConfirmations })
        const onConfirm = jest.fn()
        render(wrap(<SlideToConfirm label="Slide to pay" onConfirm={onConfirm} />))
        fireEvent.click(screen.getByRole('button', { name: 'Slide to pay' }), { detail: 1 })
        expect(onConfirm).not.toHaveBeenCalled()
        if (simplifiedConfirmations) {
            expect(screen.getByRole('dialog', { name: 'Slide to pay' })).toBeInTheDocument()
            fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
            expect(onConfirm).toHaveBeenCalledTimes(1)
        } else {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        }
    }
)

it('assistive slide activation opens a named dialog; cancel is safe and confirm runs only once', async () => {
    const onConfirm = jest.fn()
    render(wrap(<SlideToConfirm label="Slide to pay" onConfirm={onConfirm} />))
    fireEvent.click(screen.getByRole('button', { name: 'Slide to pay' }), { detail: 0 })
    expect(screen.getByRole('dialog', { name: 'Slide to pay' })).toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus())
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onConfirm).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Slide to pay' }), { detail: 0 })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Slide to pay' })).toBeDisabled()
})

it('restores full slider travel when another tab turns simplified confirmations off', () => {
    const width = jest.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(200)
    const onConfirm = jest.fn()
    updateAccessibilityPreferences({ simplifiedConfirmations: true })
    const view = render(wrap(<SlideToConfirm label="Slide to pay" onConfirm={onConfirm} />))
    try {
        act(() => {
            localStorage.setItem(ACCESSIBILITY_STORAGE_KEY, JSON.stringify({ simplifiedConfirmations: false }))
            window.dispatchEvent(new StorageEvent('storage', { key: ACCESSIBILITY_STORAGE_KEY }))
        })
        const handle = screen.getByRole('button', { name: 'Slide to pay' })
        for (let i = 0; i < 9; i++) fireEvent.keyDown(handle, { key: 'ArrowRight' })
        expect(onConfirm).not.toHaveBeenCalled()
        fireEvent.keyDown(handle, { key: 'ArrowRight' })
        expect(onConfirm).toHaveBeenCalledTimes(1)
        fireEvent.keyDown(handle, { key: 'ArrowRight' })
        expect(onConfirm).toHaveBeenCalledTimes(1)
    } finally {
        view.unmount()
        width.mockRestore()
    }
})

it('simplified confirmation survives a failed action retry and closes if disabled', () => {
    updateAccessibilityPreferences({ simplifiedConfirmations: true })
    const onConfirm = jest.fn()
    const view = render(wrap(<SlideToConfirm label="Lock card" onConfirm={onConfirm} />))
    fireEvent.click(screen.getByRole('button', { name: 'Lock card' }))
    view.rerender(wrap(<SlideToConfirm label="Lock card" onConfirm={onConfirm} disabled />))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
    view.rerender(wrap(<SlideToConfirm label="Lock card" onConfirm={onConfirm} />))
    fireEvent.click(screen.getByRole('button', { name: 'Lock card' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    view.rerender(wrap(<SlideToConfirm label="Lock card" onConfirm={onConfirm} disabled />))
    view.rerender(wrap(<SlideToConfirm label="Lock card" onConfirm={onConfirm} />))
    fireEvent.click(screen.getByRole('button', { name: 'Lock card' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(onConfirm).toHaveBeenCalledTimes(2)
})

it('hold-to-claim accepts assistive click without needing a sustained press', () => {
    const onComplete = jest.fn()
    render(wrap(<HoldToClaimButton onComplete={onComplete}>Unwrap reward</HoldToClaimButton>))
    fireEvent.click(screen.getByRole('button', { name: 'Unwrap reward' }), { detail: 0 })
    expect(onComplete).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(onComplete).toHaveBeenCalledTimes(1)
})

it.each([
    { mode: 'simplified pointer', simplifiedConfirmations: true, detail: 1 },
    { mode: 'assistive click', simplifiedConfirmations: false, detail: 0 },
])('tap-mode claims support $mode confirmation, cancellation and retry', ({ simplifiedConfirmations, detail }) => {
    updateAccessibilityPreferences({ simplifiedConfirmations })
    const onComplete = jest.fn()
    const claimButton = (disabled = false) =>
        wrap(
            <HoldToClaimButton enableTapMode onComplete={onComplete} disabled={disabled}>
                Unwrap reward
            </HoldToClaimButton>
        )
    const view = render(claimButton())
    const activate = () => {
        const button = screen.getByRole('button', { name: 'Unwrap reward' })
        if (detail === 1) {
            fireEvent.pointerDown(button)
            fireEvent.pointerUp(button)
        }
        fireEvent.click(button, { detail })
    }

    activate()
    expect(screen.getByRole('dialog', { name: 'Unwrap reward' })).toBeInTheDocument()
    expect(onComplete).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onComplete).not.toHaveBeenCalled()

    activate()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(onComplete).toHaveBeenCalledTimes(1)
    activate()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onComplete).toHaveBeenCalledTimes(1)

    // The claim is disabled while submitting and becomes available after failure.
    view.rerender(claimButton(true))
    expect(screen.getByRole('button', { name: 'Unwrap reward' })).toBeDisabled()
    activate()
    expect(onComplete).toHaveBeenCalledTimes(1)
    view.rerender(claimButton())
    activate()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    activate()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onComplete).toHaveBeenCalledTimes(2)
})

it.each([
    { mode: 'simplified pointer', simplifiedConfirmations: true, detail: 1 },
    { mode: 'assistive click', simplifiedConfirmations: false, detail: 0 },
])('long-press button offers a cancellable confirmation for $mode', ({ simplifiedConfirmations, detail }) => {
    updateAccessibilityPreferences({ simplifiedConfirmations })
    const onLongPress = jest.fn()
    render(wrap(<Button longPress={{ onLongPress }}>Continue</Button>))
    const button = screen.getByRole('button', { name: 'Continue' })
    fireEvent.click(button, { detail })
    expect(onLongPress).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onLongPress).not.toHaveBeenCalled()
    fireEvent.click(button, { detail })
    expect(onLongPress).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(onLongPress).toHaveBeenCalledTimes(1)
})

it.each(['mouse', 'touch'])('long-press button requires a sustained %s press by default', (mode) => {
    jest.useFakeTimers()
    try {
        const onLongPress = jest.fn()
        const onClick = jest.fn()
        const view = render(
            wrap(
                <Button longPress={{ duration: 2000, onLongPress }} onClick={onClick}>
                    Continue
                </Button>
            )
        )
        const button = screen.getByRole('button', { name: 'Continue' })
        const start = () => (mode === 'mouse' ? fireEvent.mouseDown(button) : fireEvent.touchStart(button))
        const release = () => {
            if (mode === 'mouse') fireEvent.mouseUp(button)
            else fireEvent.touchEnd(button)
            fireEvent.click(button, { detail: 1 })
        }
        start()
        act(() => jest.advanceTimersByTime(100))
        release()
        act(() => jest.advanceTimersByTime(2500))
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(onLongPress).not.toHaveBeenCalled()
        expect(onClick).not.toHaveBeenCalled()

        start()
        act(() => jest.advanceTimersByTime(2000))
        release()
        expect(onLongPress).toHaveBeenCalledTimes(1)
        expect(onClick).not.toHaveBeenCalled()
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        view.unmount()
    } finally {
        jest.useRealTimers()
    }
})

it('busy buttons block duplicate activation and preserve their label', () => {
    const onClick = jest.fn()
    render(
        wrap(
            <Button loading onClick={onClick}>
                Send money
            </Button>
        )
    )
    const button = screen.getByRole('button', { name: /Send money/ })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
})

it('ActionModal exposes its visible heading and description as its accessible name and description', () => {
    render(wrap(<ActionModal visible onClose={jest.fn()} title="Payment failed" description="Try again." />))
    const dialog = screen.getByRole('dialog', { name: 'Payment failed' })
    expect(dialog).toHaveAccessibleDescription('Try again.')
})

it('interactive list rows are native buttons with selected state', () => {
    const click = jest.fn()
    render(wrap(<ListItem title="English" onClick={click} aria-pressed />))
    const row = screen.getByRole('button', { name: 'English' })
    expect(row.tagName).toBe('BUTTON')
    expect(row).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(row)
    expect(click).toHaveBeenCalledTimes(1)
})

it('applies the preference when reads work but storage writes fail', () => {
    const set = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('quota')
    })
    const { result } = renderHook(() => useAccessibility())
    act(() => updateAccessibilityPreferences({ highContrast: true }))
    expect(result.current.highContrast).toBe(true)
    expect(document.documentElement).toHaveAttribute('data-high-contrast', 'true')
    set.mockRestore()
    act(() => updateAccessibilityPreferences(DEFAULT_ACCESSIBILITY))
})

it('requires a sustained pointer hold unless simplified confirmations are enabled', () => {
    jest.useFakeTimers()
    try {
        const onComplete = jest.fn()
        const view = render(wrap(<HoldToClaimButton onComplete={onComplete}>Claim preview</HoldToClaimButton>))
        const button = screen.getByRole('button', { name: 'Claim preview' })
        fireEvent.pointerDown(button)
        fireEvent.pointerUp(button)
        fireEvent.click(button, { detail: 1 })
        act(() => jest.advanceTimersByTime(5000))
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(onComplete).not.toHaveBeenCalled()

        fireEvent.pointerDown(button)
        act(() => jest.advanceTimersByTime(5000))
        fireEvent.pointerUp(button)
        fireEvent.click(button, { detail: 1 })
        expect(onComplete).toHaveBeenCalledTimes(1)
        fireEvent.pointerDown(button)
        act(() => jest.advanceTimersByTime(5000))
        fireEvent.pointerUp(button)
        expect(onComplete).toHaveBeenCalledTimes(1)
        view.unmount()
    } finally {
        jest.useRealTimers()
    }
})

it('offers a cancellable confirmation for a pointer tap when simplified confirmations are enabled', () => {
    updateAccessibilityPreferences({ simplifiedConfirmations: true })
    const onComplete = jest.fn()
    render(wrap(<HoldToClaimButton onComplete={onComplete}>Claim preview</HoldToClaimButton>))
    fireEvent.click(screen.getByRole('button', { name: 'Claim preview' }), { detail: 1 })
    expect(screen.getByRole('dialog', { name: 'Claim preview' })).toBeInTheDocument()
    expect(onComplete).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onComplete).not.toHaveBeenCalled()
})
