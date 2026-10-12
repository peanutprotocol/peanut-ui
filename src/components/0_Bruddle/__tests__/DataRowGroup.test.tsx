import { render, screen } from '@testing-library/react'
import { DataRow } from '../DataRow'
import { DataRowGroup } from '../DataRowGroup'

describe('DataRowGroup', () => {
    test('wraps its rows in one child of the card, so the divider falls between groups only', () => {
        const { container } = render(
            <div data-testid="card" className="divide-y">
                <DataRowGroup>
                    <DataRow label="Account owner" value="Demo User" />
                    <DataRow label="IBAN" value="ES27 0075" />
                </DataRowGroup>
                <DataRowGroup>
                    <DataRow label="Fee" value="$0" />
                </DataRowGroup>
            </div>
        )
        const card = screen.getByTestId('card')
        expect(card.children).toHaveLength(2)
        expect(card.children[0].querySelectorAll('.ds-data-row')).toHaveLength(2)
        expect(container.querySelectorAll('.ds-data-row-group')).toHaveLength(2)
    })

    test('renders nothing when every row resolved to nothing', () => {
        const { container } = render(
            <DataRowGroup>
                {false}
                {null}
            </DataRowGroup>
        )
        expect(container).toBeEmptyDOMElement()
    })
})
