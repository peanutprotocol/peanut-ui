/** @jest-environment jsdom */
/**
 * DotFaceAvatar — the generated self-avatar.
 *
 * Contract: fully deterministic from the username (same input, same face,
 * every render and device), case-insensitive, and distinct inputs are free
 * to differ. Only used for the user's own identity; counterparties keep
 * the initials avatar.
 */
import React from 'react'
import { render as rtlRender, screen } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import DotFaceAvatar, { dotFaceTraits } from '@/components/Global/DotFaceAvatar'

const render = (ui: React.ReactElement) => rtlRender(ui, { wrapper: IntlWrapper })

describe('DotFaceAvatar', () => {
    it('is deterministic and case-insensitive for the same username', () => {
        expect(dotFaceTraits('test022')).toEqual(dotFaceTraits('TEST022'))
        const { container: a } = render(<DotFaceAvatar username="test022" size={40} />)
        const { container: b } = render(<DotFaceAvatar username="test022" size={40} />)
        expect(a.innerHTML).toBe(b.innerHTML)
    })

    it('derives every trait from the palette and trait ranges', () => {
        for (const name of ['alice', 'bob88', 'mariana.br', 'x']) {
            const t = dotFaceTraits(name)
            // the avatar board's seven triples — the same set the initials
            // avatar uses, so the two never clash side by side
            expect(['pink', 'yellow', 'orange', 'blue', 'purple', 'red', 'green']).toContain(t.background)
            expect(t.eyeStyle).toBeGreaterThanOrEqual(0)
            expect(t.eyeStyle).toBeLessThan(5)
            expect(t.mouthStyle).toBeGreaterThanOrEqual(0)
            expect(t.mouthStyle).toBeLessThan(5)
        }
    })

    it('renders an accessible image named after the user', () => {
        render(<DotFaceAvatar username="test022" size={40} />)
        expect(screen.getByRole('img', { name: 'Avatar for test022' })).toBeInTheDocument()
    })

    it('never draws a frown: every curved mouth bulges downward (a smile)', () => {
        // one username per mouth style, found by walking the hash
        const byStyle = new Map<number, string>()
        for (let i = 0; byStyle.size < 5 && i < 10_000; i++) {
            const name = `user${i}`
            const style = dotFaceTraits(name).mouthStyle
            if (!byStyle.has(style)) byStyle.set(style, name)
        }
        expect(byStyle.size).toBe(5)
        for (const name of byStyle.values()) {
            const { container } = render(<DotFaceAvatar username={name} size={40} />)
            const paths = container.querySelectorAll('[data-testid="dot-face-mouth"] path')
            for (const path of paths) {
                const d = path.getAttribute('d') ?? ''
                // svg y grows downward, so the first control point of a
                // quadratic below its endpoints is a smile; above is a frown
                const control = /q[^0-9-]*(-?[\d.]+)\s+(-?[\d.]+)/.exec(d)
                if (control) expect(Number(control[2])).toBeGreaterThan(0)
            }
        }
    })
})
