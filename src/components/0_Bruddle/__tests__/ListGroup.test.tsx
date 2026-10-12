import { render, screen } from '@testing-library/react'
import { ListGroup } from '../ListGroup'
import { type CardPosition } from '@/components/Global/Card/card.utils'

const Probe = ({ position, label }: { position?: CardPosition; label: string }) => (
    <div data-testid={label} data-position={position} />
)

describe('ListGroup', () => {
    test('assigns first/middle/last to three children', () => {
        render(
            <ListGroup>
                <Probe label="a" />
                <Probe label="b" />
                <Probe label="c" />
            </ListGroup>
        )
        expect(screen.getByTestId('a')).toHaveAttribute('data-position', 'top')
        expect(screen.getByTestId('b')).toHaveAttribute('data-position', 'middle')
        expect(screen.getByTestId('c')).toHaveAttribute('data-position', 'bottom')
    })

    test('a lone child is single', () => {
        render(
            <ListGroup>
                <Probe label="only" />
            </ListGroup>
        )
        expect(screen.getByTestId('only')).toHaveAttribute('data-position', 'solo')
    })

    test('conditionally-hidden children renumber the rest', () => {
        const showMiddle = false
        render(
            <ListGroup>
                <Probe label="a" />
                {showMiddle && <Probe label="b" />}
                <Probe label="c" />
            </ListGroup>
        )
        expect(screen.getByTestId('a')).toHaveAttribute('data-position', 'top')
        expect(screen.getByTestId('c')).toHaveAttribute('data-position', 'bottom')
    })

    test('an explicit position on a child wins', () => {
        render(
            <ListGroup>
                <Probe label="a" position="solo" />
                <Probe label="b" />
            </ListGroup>
        )
        expect(screen.getByTestId('a')).toHaveAttribute('data-position', 'solo')
        expect(screen.getByTestId('b')).toHaveAttribute('data-position', 'bottom')
    })
})
