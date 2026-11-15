import { act, fireEvent, render, screen } from '@testing-library/react'
import { getTranslations } from '@/i18n'
import { SUPPORTED_LOCALES } from '@/i18n/types'
import { HomePersonaFold } from '../HomePersonaFold'
import { HOME_PERSONA_AVATARS, HOME_PERSONA_CYCLE_MS } from '../homePersona.consts'
import { landingStrings } from '../landingStrings'

let reducedMotion = false
let observerCallback: IntersectionObserverCallback | null = null
let motionChange: (() => void) | null = null

beforeEach(() => {
    jest.useFakeTimers()
    reducedMotion = false
    observerCallback = null
    motionChange = null
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
    window.matchMedia = jest.fn().mockImplementation((query: string) => ({
        get matches() {
            return reducedMotion && query.includes('reduce')
        },
        media: query,
        addEventListener: jest.fn((_event: string, callback: () => void) => {
            motionChange = callback
        }),
        removeEventListener: jest.fn(),
    }))
    window.IntersectionObserver = jest.fn().mockImplementation((callback: IntersectionObserverCallback) => {
        observerCallback = callback
        return { observe: jest.fn(), disconnect: jest.fn(), unobserve: jest.fn() }
    }) as unknown as typeof IntersectionObserver
})

afterEach(() => {
    jest.useRealTimers()
})

const strings = landingStrings(getTranslations('en')).personas

function setOnScreen(isIntersecting: boolean) {
    act(() => {
        observerCallback?.([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver)
    })
}

const pressed = () => screen.getAllByRole('button').findIndex((b) => b.getAttribute('aria-pressed') === 'true')

describe('HomePersonaFold', () => {
    it('gives every locale a trade, city and line for each earner', () => {
        for (const locale of SUPPORTED_LOCALES) {
            const personas = landingStrings(getTranslations(locale)).personas
            for (const { key } of HOME_PERSONA_AVATARS) {
                expect(personas[key].who).toMatch(/\S, \S/)
                expect(personas[key].line).toMatch(/\.$/)
            }
        }
    })

    it('says the US employer line in English as Konrad asked, not "my salary"', () => {
        expect(strings.developer.line).toBe('I get paid by a US employer.')
        const lines = HOME_PERSONA_AVATARS.map(({ key }) => strings[key].line).join(' ')
        expect(lines).toMatch(/Berlin/)
        expect(lines).toMatch(/Madrid/)
        expect(lines).toMatch(/Milan/)
        expect(lines).not.toMatch(/salary/i)
    })

    it('cycles one earner at a time while on screen, and not before', () => {
        render(<HomePersonaFold strings={strings} />)
        expect(pressed()).toBe(0)
        act(() => jest.advanceTimersByTime(HOME_PERSONA_CYCLE_MS * 2))
        expect(pressed()).toBe(0)

        setOnScreen(true)
        act(() => jest.advanceTimersByTime(HOME_PERSONA_CYCLE_MS))
        expect(pressed()).toBe(1)
        // each step schedules the next after it renders, so advance one step at a time
        for (let i = 1; i < HOME_PERSONA_AVATARS.length; i++) act(() => jest.advanceTimersByTime(HOME_PERSONA_CYCLE_MS))
        expect(pressed()).toBe(0)

        setOnScreen(false)
        act(() => jest.advanceTimersByTime(HOME_PERSONA_CYCLE_MS * 3))
        expect(pressed()).toBe(0)
    })

    it('pauses on hover and keyboard focus, and a picked avatar stops the cycle and is announced', () => {
        const { container } = render(<HomePersonaFold strings={strings} />)
        setOnScreen(true)
        const buttons = screen.getAllByRole('button')
        const stage = buttons[0].closest('ul')!.parentElement!

        fireEvent.mouseEnter(stage)
        act(() => jest.advanceTimersByTime(HOME_PERSONA_CYCLE_MS * 2))
        expect(pressed()).toBe(0)
        fireEvent.mouseLeave(stage)

        fireEvent.focus(buttons[0])
        act(() => jest.advanceTimersByTime(HOME_PERSONA_CYCLE_MS * 2))
        expect(pressed()).toBe(0)

        const live = container.querySelector('[aria-live]')!
        expect(live).toHaveAttribute('aria-live', 'off')
        fireEvent.click(buttons[3])
        expect(pressed()).toBe(3)
        expect(live).toHaveAttribute('aria-live', 'polite')
        expect(live).toHaveTextContent(`${strings.writer.who}: ${strings.writer.line}`)

        fireEvent.blur(buttons[3])
        act(() => jest.advanceTimersByTime(HOME_PERSONA_CYCLE_MS * 3))
        expect(pressed()).toBe(3)
    })

    it('pauses while the document is hidden and gives the next earner a full reading interval on return', () => {
        render(<HomePersonaFold strings={strings} />)
        setOnScreen(true)
        act(() => jest.advanceTimersByTime(HOME_PERSONA_CYCLE_MS / 2))
        Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
        fireEvent(document, new Event('visibilitychange'))
        act(() => jest.advanceTimersByTime(HOME_PERSONA_CYCLE_MS * 3))
        expect(pressed()).toBe(0)

        Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
        fireEvent(document, new Event('visibilitychange'))
        act(() => jest.advanceTimersByTime(HOME_PERSONA_CYCLE_MS - 1))
        expect(pressed()).toBe(0)
        act(() => jest.advanceTimersByTime(1))
        expect(pressed()).toBe(1)
    })

    it('returns to the first earner when reduced motion is enabled while cycling', () => {
        render(<HomePersonaFold strings={strings} />)
        setOnScreen(true)
        act(() => jest.advanceTimersByTime(HOME_PERSONA_CYCLE_MS))
        expect(pressed()).toBe(1)
        act(() => {
            reducedMotion = true
            motionChange?.()
        })
        expect(pressed()).toBe(0)
        act(() => jest.advanceTimersByTime(HOME_PERSONA_CYCLE_MS * 3))
        expect(pressed()).toBe(0)
    })

    it('keeps the first earner and still avatars under reduced motion, reserving the tallest card height', () => {
        reducedMotion = true
        const { container } = render(<HomePersonaFold strings={strings} />)
        setOnScreen(true)
        act(() => jest.advanceTimersByTime(HOME_PERSONA_CYCLE_MS * 3))
        expect(pressed()).toBe(0)

        const buttons = screen.getAllByRole('button')
        buttons.forEach((button) => expect(button).toBeDisabled())
        fireEvent.click(buttons[3])
        expect(pressed()).toBe(0)

        // the cycling cards are art: hidden from screen readers, stacked in one grid cell
        const stack = container.querySelector('[aria-hidden="true"].grid')!
        const cards = stack.querySelectorAll('article')
        expect(cards).toHaveLength(HOME_PERSONA_AVATARS.length)
        cards.forEach((card) => expect(card.className).toContain('row-start-1'))
        expect(Array.from(cards).filter((card) => !card.classList.contains('invisible'))).toHaveLength(1)
    })
})
