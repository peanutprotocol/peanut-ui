/** @jest-environment jsdom */
import fs from 'fs'
import path from 'path'
import React from 'react'
import { act, render, screen } from '@testing-library/react'
import { RESIDENCE_WAVE_MS, ResidenceHero } from '../ResidenceHero'

const mockFlow = { residenceCountry: '' }
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
    MASCOT_ANIMATION_LOADERS: { cheering: () => Promise.resolve({ default: {} }) },
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

describe('ResidenceHero', () => {
    beforeEach(() => {
        jest.useFakeTimers()
        mockFlow.residenceCountry = ''
        mockReducedMotion.value = false
    })
    afterEach(() => {
        jest.useRealTimers()
    })

    it('waves first for a prefilled sticker country, then cheers with its three stickers and five decorations', () => {
        mockFlow.residenceCountry = 'AR'
        const { container } = render(<ResidenceHero alt="Peanut mascot" />)
        expect(pose()).toBe('waving-hello')
        expect(stickers(container)).toEqual([])

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

    it('celebrates at once when a sticker country is picked after the wave', () => {
        mockFlow.residenceCountry = 'JP'
        const { container, rerender } = render(<ResidenceHero alt="Peanut mascot" />)
        wave()
        mockFlow.residenceCountry = 'US'
        rerender(<ResidenceHero alt="Peanut mascot" />)
        expect(pose()).toBe('cheering')
        expect(stickers(container)).toEqual([
            '/residence-stickers/us-hotdog.webp',
            '/residence-stickers/us-baseball.webp',
            '/residence-stickers/us-liberty.webp',
        ])
    })

    it('swaps the stickers on a change of country, replaying the slap on a fresh layer', () => {
        mockFlow.residenceCountry = 'AR'
        const { container, rerender } = render(<ResidenceHero alt="Peanut mascot" />)
        wave()
        const firstLayer = container.querySelector('.residence-stickers')

        mockFlow.residenceCountry = 'BR'
        rerender(<ResidenceHero alt="Peanut mascot" />)
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
        wave()
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
        expect(pose()).toBe('cheering')
        expect(stickers(container)).toHaveLength(3)
        expect(decorations(container)).toHaveLength(5)
    })

    it('keeps the stickers and decorations out of the accessibility tree and out of the way of taps', () => {
        mockFlow.residenceCountry = 'AR'
        const { container } = render(<ResidenceHero alt="Peanut mascot" />)
        wave()
        const layer = container.querySelector('.residence-stickers')
        expect(layer).toHaveAttribute('aria-hidden', 'true')
        layer?.querySelectorAll('img').forEach((img) => expect(img).toHaveAttribute('alt', ''))
        expect(screen.getByLabelText('Peanut mascot')).toBe(screen.getByTestId('mascot'))
    })

    it('orders the decorations star, sparkle, star, star, sparkle', () => {
        mockFlow.residenceCountry = 'AR'
        const { container } = render(<ResidenceHero alt="Peanut mascot" />)
        wave()
        const sources = decorations(container).map((img) => img.getAttribute('src'))
        expect(sources[0]).toBe(sources[2])
        expect(sources[0]).toBe(sources[3])
        expect(sources[1]).toBe(sources[4])
        expect(decorations(container).map((img) => img.getAttribute('data-deco'))).toEqual(['0', '1', '2', '3', '4'])
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
