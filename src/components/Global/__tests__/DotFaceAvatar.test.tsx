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
            expect(['#FF90E8', '#FFC900', '#BA8BFF', '#98E9AB', '#90A8ED']).toContain(t.background)
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
})
