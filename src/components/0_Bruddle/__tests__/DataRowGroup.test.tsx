import { render, screen } from '@testing-library/react'
import { DataRow } from '@/components/0_Bruddle/DataRow'
import { DataRowGroup } from '@/components/0_Bruddle/DataRowGroup'

describe('DataRowGroup', () => {
    it('holds its rows in one block and draws no border of its own', () => {
        const { container } = render(
            <DataRowGroup>
                <DataRow label="Fee" value="$0" />
                <DataRow label="Bank receives" value="$80" />
            </DataRowGroup>
        )
        const group = container.firstElementChild as HTMLElement
        expect(group.querySelectorAll('.ds-data-row')).toHaveLength(2)
        expect(group.className).not.toMatch(/border|divide/)
        expect(screen.getByText('Fee')).toBeInTheDocument()
    })

    it('renders nothing when every row was conditional and none rendered', () => {
        const { container } = render(
            <DataRowGroup>
                {false}
                {null}
                {undefined}
            </DataRowGroup>
        )
        expect(container).toBeEmptyDOMElement()
    })
})
