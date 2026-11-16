/** @jest-environment jsdom */
import fs from 'fs'
import path from 'path'
import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { RESIDENCE_PICK_DELAY_MS, RESIDENCE_STICKER_LOAD_MS, RESIDENCE_WAVE_MS, ResidenceHero } from '../ResidenceHero'

const mockFlow = { residenceCountry: '', residenceWaveDone: { current: false } }
// The cheering chunk, settled by hand like the sticker files below. A plain
// thenable keeps the tests synchronous.
let mockPoseLoads: (() => void)[] = []
const mockLoadCheering = jest.fn(() => ({ then: (done: () => void) => void mockPoseLoads.push(done) }))
const mockReducedMotion = { value: false }

jest.mock('@/features/setup/SetupFlowContext', () => ({ useSetupFlowContext: () => mockFlow }))
jest.mock('framer-motion', () => ({ useReducedMotion: () => mockReducedMotion.value }))
jest.mock('@/components/Global/PeanutMascot', () => ({
    __esModule: true,
    default: ({ pose, alt }: { pose: string; alt?: string }) => (
        <div data-testid="mascot" data-mascot-pose={pose} aria-label={alt} />
    ),
}))
jest.mock('@/components/Global/PeanutMascot/PeanutMascot.consts', () => ({
    MASCOT_ANIMATION_LOADERS: { cheering: () => mockLoadCheering() },
}))
jest.mock('next/image', () => ({
    __esModule: true,
    default: ({
        src,
        alt,
        className,
        style,
        ...rest
    }: {
        src: string | { src: string }
        alt: string
        className?: string
        style?: React.CSSProperties
        'data-sticker'?: number
        'data-deco'?: number
    }) => (
        <img
            src={typeof src === 'string' ? src : src.src}
            alt={alt}
            className={className}
            style={style}
            data-sticker={rest['data-sticker']}
            data-deco={rest['data-deco']}
        />
    ),
}))

const pose = () => screen.getByTestId('mascot').getAttribute('data-mascot-pose')
const stickers = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('img.residence-sticker')).map((img) => img.getAttribute('src'))
const decorations = (container: HTMLElement) => Array.from(container.querySelectorAll('img.residence-deco'))
const wave = () => act(() => jest.advanceTimersByTime(RESIDENCE_WAVE_MS))

// jsdom never fetches an image, so the preloads are settled by hand.
type Preload = { src: string; onload: (() => void) | null; onerror: (() => void) | null }
let preloads: Preload[] = []
class MockPreloadImage {
    src = ''
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    constructor() {
        preloads.push(this)
    }
}
/** Settles every pending sticker fetch and the cheering chunk; `fail` makes the stickers errors. */
const loadStickers = (fail = false, { pose = true } = {}) =>
    act(() => {
        const pending = preloads
        preloads = []
        pending.forEach((image) => (fail ? image.onerror : image.onload)?.())
        if (pose) mockPoseLoads.splice(0).forEach((done) => done())
    })
const pickerCloses = () => act(() => jest.advanceTimersByTime(RESIDENCE_PICK_DELAY_MS))

describe('ResidenceHero', () => {
    let realImage: typeof window.Image

    beforeEach(() => {
        jest.useFakeTimers()
        mockFlow.residenceCountry = ''
        mockFlow.residenceWaveDone = { current: false }
        mockReducedMotion.value = false
        mockLoadCheering.mockClear()
        mockPoseLoads = []
        preloads = []
        realImage = window.Image
        window.Image = MockPreloadImage as unknown as typeof window.Image
    })
    afterEach(() => {
        window.Image = realImage
        jest.useRealTimers()
    })

    it('waves first for a prefilled sticker country, then cheers with its three stickers and five decorations', () => {
        mockFlow.residenceCountry = 'AR'
        const { container } = render(<ResidenceHero alt="Peanut mascot" />)
        expect(pose()).toBe('waving-hello')
        expect(stickers(container)).toEqual([])
        // The files arrive during the wave; the wave still runs its full time.
        loadStickers()

        act(() => jest.advanceTimersByTime(RESIDENCE_WAVE_MS - 1))
        expect(pose()).toBe('waving-hello')
        expect(stickers(container)).toEqual([])

        act(() => jest.advanceTimersByTime(1))
        expect(pose()).toBe('cheering')
        expect(stickers(container)).toEqual([
            '/residence-stickers/ar-mate.webp',
            '/residence-stickers/ar-sol.webp',
            '/residence-stickers/ar-alfajor.webp',
        ])
        expect(decorations(container)).toHaveLength(5)
    })

    it('keeps waving, with no stickers, for a country outside the 20', () => {
        mockFlow.residenceCountry = 'JP'
        const { container } = render(<ResidenceHero alt="Peanut mascot" />)
        wave()
        expect(pose()).toBe('waving-hello')
        expect(stickers(container)).toEqual([])
        expect(decorations(container)).toEqual([])
    })

    it('keeps waving while no country is chosen', () => {
        const { container } = render(<ResidenceHero alt="Peanut mascot" />)
        wave()
        expect(pose()).toBe('waving-hello')
        expect(stickers(container)).toEqual([])
    })

    it('celebrates as soon as the picker has closed when a sticker country is picked after the wave', () => {
        mockFlow.residenceCountry = 'JP'
        const { container, rerender } = render(<ResidenceHero alt="Peanut mascot" />)
        wave()
        mockFlow.residenceCountry = 'US'
        rerender(<ResidenceHero alt="Peanut mascot" />)
        loadStickers()
        // The files are there, but the picker is still closing over the hero.
        act(() => jest.advanceTimersByTime(RESIDENCE_PICK_DELAY_MS - 1))
        expect(pose()).toBe('waving-hello')
        expect(stickers(container)).toEqual([])
        expect(decorations(container)).toEqual([])
        act(() => jest.advanceTimersByTime(1))
        expect(pose()).toBe('cheering')
        expect(stickers(container)).toEqual([
            '/residence-stickers/us-hotdog.webp',
            '/residence-stickers/us-baseball.webp',
            '/residence-stickers/us-liberty.webp',
        ])
    })

    it('waits for the picker to close when a country is picked just before the wave ends', () => {
        mockFlow.residenceCountry = 'JP'
        const { container, rerender } = render(<ResidenceHero alt="Peanut mascot" />)
        act(() => jest.advanceTimersByTime(RESIDENCE_WAVE_MS - 100))
        mockFlow.residenceCountry = 'US'
        rerender(<ResidenceHero alt="Peanut mascot" />)
        loadStickers()
        // The wave ends, but the picker opened 100 ms ago is still closing.
        act(() => jest.advanceTimersByTime(RESIDENCE_PICK_DELAY_MS - 1))
        expect(pose()).toBe('waving-hello')
        expect(stickers(container)).toEqual([])
        act(() => jest.advanceTimersByTime(1))
        expect(pose()).toBe('cheering')
        expect(stickers(container)).toHaveLength(3)
    })

    it('swaps the stickers on a change of country, replaying the slap on a fresh layer', () => {
        mockFlow.residenceCountry = 'AR'
        const { container, rerender } = render(<ResidenceHero alt="Peanut mascot" />)
        loadStickers()
        wave()
        const firstLayer = container.querySelector('.residence-stickers')
        expect(firstLayer).not.toBeNull()

        mockFlow.residenceCountry = 'BR'
        rerender(<ResidenceHero alt="Peanut mascot" />)
        expect(pose()).toBe('cheering')
        // The old country's stickers leave at once; the new ones wait for their files
        // and the picker, while the mascot keeps cheering.
        expect(stickers(container)).toEqual([])
        loadStickers()
        expect(stickers(container)).toEqual([])
        pickerCloses()
        expect(pose()).toBe('cheering')
        expect(stickers(container)).toEqual([
            '/residence-stickers/br-brigadeiro.webp',
            '/residence-stickers/br-tucano.webp',
            '/residence-stickers/br-coxinha.webp',
        ])
        // A new element, so the CSS slap runs again instead of the old stickers changing in place.
        expect(container.querySelector('.residence-stickers')).not.toBe(firstLayer)
    })

    it('returns to the wave when the country changes to one without stickers', () => {
        mockFlow.residenceCountry = 'AR'
        const { container, rerender } = render(<ResidenceHero alt="Peanut mascot" />)
        loadStickers()
        wave()
        expect(stickers(container)).toHaveLength(3)
        mockFlow.residenceCountry = 'JP'
        rerender(<ResidenceHero alt="Peanut mascot" />)
        expect(pose()).toBe('waving-hello')
        expect(stickers(container)).toEqual([])
        expect(decorations(container)).toEqual([])
    })

    it('shows the stickers without the wave delay under reduced motion', () => {
        mockReducedMotion.value = true
        mockFlow.residenceCountry = 'AR'
        const { container } = render(<ResidenceHero alt="Peanut mascot" />)
        expect(stickers(container)).toHaveLength(3)
        expect(decorations(container)).toHaveLength(5)
        loadStickers()
        expect(pose()).toBe('cheering')
    })

    it('keeps the stickers and decorations out of the accessibility tree and out of the way of taps', () => {
        mockFlow.residenceCountry = 'AR'
        const { container } = render(<ResidenceHero alt="Peanut mascot" />)
        loadStickers()
        wave()
        const layer = container.querySelector('.residence-stickers')
        expect(layer).toHaveAttribute('aria-hidden', 'true')
        layer?.querySelectorAll('img').forEach((img) => expect(img).toHaveAttribute('alt', ''))
        expect(screen.getByLabelText('Peanut mascot')).toBe(screen.getByTestId('mascot'))
    })

    it('orders the decorations star, sparkle, star, star, sparkle', () => {
        mockFlow.residenceCountry = 'AR'
        const { container } = render(<ResidenceHero alt="Peanut mascot" />)
        loadStickers()
        wave()
        const sources = decorations(container).map((img) => img.getAttribute('src'))
        expect(sources[0]).toBe(sources[2])
        expect(sources[0]).toBe(sources[3])
        expect(sources[1]).toBe(sources[4])
        expect(decorations(container).map((img) => img.getAttribute('data-deco'))).toEqual(['0', '1', '2', '3', '4'])
    })

    it('holds the slap until the three files have loaded, and no longer than the fallback', () => {
        // The wave is over, so only the files hold the slap back.
        mockFlow.residenceWaveDone = { current: true }
        mockFlow.residenceCountry = 'AR'
        const { container } = render(<ResidenceHero alt="Peanut mascot" />)
        expect(stickers(container)).toEqual([])

        act(() => jest.advanceTimersByTime(RESIDENCE_STICKER_LOAD_MS - 1))
        expect(stickers(container)).toEqual([])
        act(() => jest.advanceTimersByTime(1))
        expect(stickers(container)).toHaveLength(3)
    })

    it('keeps waving until the cheering pose has loaded, so the mascot never blanks', () => {
        mockFlow.residenceCountry = 'AR'
        const { container } = render(<ResidenceHero alt="Peanut mascot" />)
        // The sticker files are in; the cheering chunk is still on its way.
        loadStickers(false, { pose: false })
        act(() => jest.advanceTimersByTime(RESIDENCE_STICKER_LOAD_MS - 1))
        expect(pose()).toBe('waving-hello')

        // The fallback (over before the wave is) releases the stickers only; the pose has no time limit.
        wave()
        expect(pose()).toBe('waving-hello')
        expect(stickers(container)).toHaveLength(3)
        act(() => jest.advanceTimersByTime(RESIDENCE_STICKER_LOAD_MS * 10))
        expect(pose()).toBe('waving-hello')

        loadStickers()
        expect(pose()).toBe('cheering')
        expect(stickers(container)).toHaveLength(3)
    })

    it('keeps waving under reduced motion until the cheering pose has loaded', () => {
        mockReducedMotion.value = true
        const { container, rerender } = render(<ResidenceHero alt="Peanut mascot" />)
        expect(pose()).toBe('waving-hello')
        mockFlow.residenceCountry = 'AR'
        rerender(<ResidenceHero alt="Peanut mascot" />)
        // The stickers are still; the pose changes only when it can be drawn.
        expect(stickers(container)).toHaveLength(3)
        expect(pose()).toBe('waving-hello')
        act(() => jest.advanceTimersByTime(RESIDENCE_STICKER_LOAD_MS * 10))
        expect(pose()).toBe('waving-hello')
        loadStickers()
        expect(pose()).toBe('cheering')
    })

    it('waits for the pose again on a hand-pick after returning from the compare view', () => {
        // Back from the compare view: the wave is done and a sticker country is set.
        mockFlow.residenceWaveDone = { current: true }
        mockFlow.residenceCountry = 'AR'
        const { rerender } = render(<ResidenceHero alt="Peanut mascot" />)
        expect(pose()).toBe('waving-hello')
        mockFlow.residenceCountry = 'BR'
        rerender(<ResidenceHero alt="Peanut mascot" />)
        act(() => jest.advanceTimersByTime(RESIDENCE_STICKER_LOAD_MS * 10))
        expect(pose()).toBe('waving-hello')
        loadStickers()
        expect(pose()).toBe('cheering')
    })

    it('renders each sticker from the very URL it preloaded, so it is fetched once', () => {
        mockFlow.residenceCountry = 'AR'
        const { container } = render(<ResidenceHero alt="Peanut mascot" />)
        const preloaded = preloads.map((image) => image.src)
        expect(preloaded).toHaveLength(3)
        loadStickers()
        wave()
        expect(stickers(container)).toEqual(preloaded)
    })

    it('leaves out a sticker whose preload failed, and carries on with the rest', () => {
        mockFlow.residenceCountry = 'AR'
        const { container } = render(<ResidenceHero alt="Peanut mascot" />)
        act(() => preloads[1].onerror?.())
        loadStickers()
        wave()
        expect(pose()).toBe('cheering')
        expect(stickers(container)).toEqual(['/residence-stickers/ar-mate.webp', '/residence-stickers/ar-alfajor.webp'])
        // The others keep their own places.
        expect(
            Array.from(container.querySelectorAll('img.residence-sticker')).map((img) =>
                img.getAttribute('data-sticker')
            )
        ).toEqual(['0', '2'])
        expect(decorations(container)).toHaveLength(5)
    })

    it('removes a sticker that fails after it was rendered', () => {
        mockFlow.residenceCountry = 'AR'
        const { container } = render(<ResidenceHero alt="Peanut mascot" />)
        loadStickers()
        wave()
        fireEvent.error(container.querySelectorAll('img.residence-sticker')[0])
        expect(pose()).toBe('cheering')
        expect(stickers(container)).toEqual(['/residence-stickers/ar-sol.webp', '/residence-stickers/ar-alfajor.webp'])
    })

    it('does not let failed sticker fetches hold the celebration', () => {
        mockFlow.residenceCountry = 'AR'
        const { container } = render(<ResidenceHero alt="Peanut mascot" />)
        loadStickers(true)
        wave()
        expect(pose()).toBe('cheering')
        expect(stickers(container)).toEqual([])
        expect(decorations(container)).toHaveLength(5)
    })

    it('waves the full time for a country that arrives during the wave', () => {
        const { container, rerender } = render(<ResidenceHero alt="Peanut mascot" />)
        act(() => jest.advanceTimersByTime(RESIDENCE_WAVE_MS / 2))
        mockFlow.residenceCountry = 'AR'
        rerender(<ResidenceHero alt="Peanut mascot" />)
        loadStickers()
        expect(pose()).toBe('waving-hello')

        act(() => jest.advanceTimersByTime(RESIDENCE_WAVE_MS / 2 - 1))
        expect(pose()).toBe('waving-hello')
        expect(stickers(container)).toEqual([])
        act(() => jest.advanceTimersByTime(1))
        expect(pose()).toBe('cheering')
        expect(stickers(container)).toHaveLength(3)
    })

    it('clears its timers when it unmounts during the wave, and waves again on return', () => {
        mockFlow.residenceCountry = 'AR'
        const first = render(<ResidenceHero alt="Peanut mascot" />)
        act(() => jest.advanceTimersByTime(RESIDENCE_WAVE_MS - 1))
        first.unmount()
        expect(jest.getTimerCount()).toBe(0)
        act(() => jest.advanceTimersByTime(RESIDENCE_WAVE_MS))
        expect(mockFlow.residenceWaveDone.current).toBe(false)

        render(<ResidenceHero alt="Peanut mascot" />)
        expect(pose()).toBe('waving-hello')
    })

    it('celebrates at once when it remounts after the wave, as after the compare view or Back', () => {
        mockFlow.residenceCountry = 'JP'
        const first = render(<ResidenceHero alt="Peanut mascot" />)
        wave()
        mockFlow.residenceCountry = 'AR'
        first.rerender(<ResidenceHero alt="Peanut mascot" />)
        loadStickers()
        first.unmount()

        const { container } = render(<ResidenceHero alt="Peanut mascot" />)
        loadStickers()
        expect(pose()).toBe('cheering')
        expect(stickers(container)).toHaveLength(3)
        expect(jest.getTimerCount()).toBe(0)
    })

    it('fetches the cheering pose only for a sticker country', () => {
        mockFlow.residenceCountry = 'JP'
        const { rerender } = render(<ResidenceHero alt="Peanut mascot" />)
        wave()
        expect(mockLoadCheering).not.toHaveBeenCalled()
        expect(preloads).toEqual([])

        mockFlow.residenceCountry = 'AR'
        rerender(<ResidenceHero alt="Peanut mascot" />)
        expect(mockLoadCheering).toHaveBeenCalledTimes(1)
        expect(preloads.map((image) => image.src)).toEqual([
            '/residence-stickers/ar-mate.webp',
            '/residence-stickers/ar-sol.webp',
            '/residence-stickers/ar-alfajor.webp',
        ])
    })

    it('mirrors only the last sparkle, and stills everything under reduced motion', () => {
        const css = fs.readFileSync(path.join(process.cwd(), 'src/styles/globals.css'), 'utf8')
        const mirrored = Array.from(css.matchAll(/\.residence-deco\[data-deco='(\d)'\] \{[^}]*--fx: -1;/g))
        expect(mirrored.map((match) => match[1])).toEqual(['4'])
        expect(css).toMatch(
            /@media \(prefers-reduced-motion: reduce\) \{\s*\.residence-sticker,\s*\.residence-deco \{\s*animation: none;/
        )
    })
})
