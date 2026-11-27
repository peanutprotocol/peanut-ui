/**
 * The tooltip is `position: fixed`, so its coordinates must come from where the
 * trigger is when the user taps it. A trigger that mounts below the fold (or
 * inside a drawer that is still sliding in) can reach the screen without a
 * scroll or resize event, and the tooltip then painted off-screen (TASK-21672).
 */
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import MoreInfo from '@/components/Global/MoreInfo'

const VIEWPORT_HEIGHT = 667
const TRIGGER_SIZE = 20

const rectAt = (top: number): DOMRect =>
    ({
        top,
        bottom: top + TRIGGER_SIZE,
        left: 100,
        right: 100 + TRIGGER_SIZE,
        width: TRIGGER_SIZE,
        height: TRIGGER_SIZE,
        x: 100,
        y: top,
        toJSON: () => ({}),
    }) as DOMRect

describe('MoreInfo tooltip position', () => {
    let triggerTop: number
    let rectSpy: jest.SpyInstance

    beforeEach(() => {
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: VIEWPORT_HEIGHT })
        rectSpy = jest
            .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
            .mockImplementation(() => rectAt(triggerTop))
    })

    afterEach(() => rectSpy.mockRestore())

    it('follows a trigger that mounted below the fold and came into view without a scroll event', async () => {
        triggerTop = 900
        render(<MoreInfo text="Use this message in your transfer" aria-label="More info" />)

        // The row is on screen now, and nothing fired `scroll` or `resize`.
        triggerTop = 300
        fireEvent.click(screen.getByRole('button', { name: 'More info' }))

        const tooltip = (await screen.findByText('Use this message in your transfer')).closest('[style]') as HTMLElement
        expect(tooltip.style.position).toBe('fixed')
        expect(tooltip.style.top).toBe(`${300 + TRIGGER_SIZE + 8}px`)
        expect(tooltip.style.bottom).toBe('')
    })
})
