import { fireEvent, render, screen } from '@testing-library/react'
import Inspector from '../Inspector'
import type { ExplorerNode } from '../types'

const node = (id: string): ExplorerNode => ({
    id,
    type: 'USER',
    label: `User · ${id}`,
    labelVisibility: 'PSEUDONYMOUS',
    paymentCount: 1,
    overlayCount: 0,
    assets: [],
    revealToken: `reveal-${id}`,
})

describe('Inspector reveal isolation', () => {
    it('resets the audited reason and error when the selected node changes', async () => {
        const first = node('A1')
        const second = node('B2')
        const onReveal = jest.fn().mockRejectedValue(new Error('denied'))
        const props = {
            nodes: [first, second],
            relationships: [],
            canReveal: true,
            revealing: false,
            revealed: null,
            onReveal,
            onSelectRelationship: jest.fn(),
            onClear: jest.fn(),
        }
        const { rerender } = render(<Inspector {...props} selection={{ type: 'node', node: first }} />)

        fireEvent.change(screen.getByLabelText('Reveal reason'), { target: { value: 'FRAUD_REVIEW' } })
        fireEvent.click(screen.getByRole('button', { name: 'Verify & reveal' }))
        expect(await screen.findByRole('alert')).toBeInTheDocument()
        expect(screen.getByLabelText('Reveal reason')).toHaveValue('FRAUD_REVIEW')

        rerender(<Inspector {...props} selection={{ type: 'node', node: second }} />)

        expect(screen.getByLabelText('Reveal reason')).toHaveValue('')
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })
})
