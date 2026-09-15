import { render, screen } from '@testing-library/react'
import { Button } from '../Button'

describe('Button', () => {
    test('shadowless variant renders no press translate', () => {
        render(<Button variant="transparent">Ghost</Button>)
        expect(screen.getByRole('button', { name: /Ghost/ }).className).not.toContain('active:translate')
    })

    test('purple (shadowed) variant renders press translate', () => {
        render(<Button variant="purple">Pay</Button>)
        const cls = screen.getByRole('button', { name: /Pay/ }).className
        expect(cls).toContain('active:translate-x-1')
        expect(cls).toContain('active:translate-y-1')
    })

    test('caller shadow-none suppresses press translate even on purple', () => {
        render(
            <Button variant="purple" className="shadow-none">
                Flat
            </Button>
        )
        expect(screen.getByRole('button', { name: /Flat/ }).className).not.toContain('active:translate')
    })

    test('loading hides children svg icons via class', () => {
        render(
            <Button loading>
                <svg data-testid="child-icon" />
                Sending
            </Button>
        )
        expect(screen.getByRole('button', { name: /Sending/ }).className).toContain('[&_svg]:hidden')
    })
})
