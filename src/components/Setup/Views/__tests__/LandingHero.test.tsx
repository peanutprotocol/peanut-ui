/** @jest-environment jsdom */
import React from 'react'
import { act, cleanup, screen } from '@testing-library/react'
import { frameData, frameSteps, MotionGlobalConfig, time } from 'framer-motion'
import { renderWithIntl } from '@/test-utils/intl'
import LandingHero from '../LandingHero'

jest.mock('@/components/Global/PeanutMascot', () => ({
    __esModule: true,
    default: ({ pose }: { pose: string }) => <div data-testid="mascot" data-mascot-pose={pose} />,
}))
jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ alt }: { alt: string }) => <img alt={alt} />,
}))

beforeEach(() => {
    MotionGlobalConfig.useManualTiming = true
    frameData.timestamp = 0
    time.set(0)
})
afterEach(() => {
    cleanup()
    MotionGlobalConfig.useManualTiming = false
})

// Drive real Motion frames, as SetupWrapper.transition.test.tsx does.
async function advance(ms: number) {
    for (let elapsed = 0; elapsed < ms; elapsed += 1000 / 60) {
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

const cardSticker = () => screen.getByText('USD 1,200').closest('[data-sticker-bob]')?.parentElement as HTMLElement

describe('LandingHero', () => {
    it('pops the stickers in and then bobs the card', async () => {
        renderWithIntl(<LandingHero title="Get paid from the US and Europe." still={false} />)
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Get paid from the US and Europe.')
        expect(screen.getByTestId('mascot')).toHaveAttribute('data-mascot-pose', 'cheering')
        // starts hidden, small and over-rotated
        expect(cardSticker().style.opacity).toBe('0')

        await advance(500)
        expect(cardSticker().style.opacity).toBe('1')
        const bob = screen.getByText('USD 1,200').closest('[data-sticker-bob]') as HTMLElement
        const before = bob.style.transform
        await advance(600)
        expect(bob.style.transform).not.toBe(before)
        expect(screen.getByText('USD')).toBeInTheDocument()
        expect(screen.getByText('EUR')).toBeInTheDocument()
    })

    it('shows the resting frame under reduced motion', () => {
        renderWithIntl(<LandingHero title="Get paid from the US and Europe." still />)
        expect(screen.getByText('USD 1,200').closest('[data-sticker-bob]')).toBeNull()
        expect(screen.getByText('Example')).toBeVisible()
    })
})
