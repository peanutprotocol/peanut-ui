import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'

jest.mock('next/navigation', () => ({ usePathname: () => '/dev/ds/primitives/button' }))

import { DocNavList } from '../_components/DocNavList'

describe('DocNavList', () => {
    // the old DocSidebar lost the 44px touch target twice. the rows are flush-stacked,
    // so a row shorter than that is both a miss and a neighbour's hit.
    it('gives every nav row a 44px minimum hit target', () => {
        render(<DocNavList />)

        const rows = screen.getAllByRole('link')
        expect(rows.length).toBeGreaterThan(0)
        rows.forEach((row) => expect(row.className).toContain('min-h-11'))
    })

    // a live region announces a text change, not its own arrival: created together
    // with its text it is silent, so the region has to outlive the empty result.
    it('keeps the empty-result status region mounted while results exist', () => {
        render(<DocNavList />)

        expect(screen.getByRole('status').textContent).toBe('')

        fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzzznotathing' } })

        expect(screen.getByRole('status').textContent).toContain('No entry matches')
        expect(screen.queryAllByRole('link')).toHaveLength(0)
    })
})
