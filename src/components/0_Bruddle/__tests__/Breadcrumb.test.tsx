import { render, screen } from '@testing-library/react'
import { Breadcrumb } from '../Breadcrumb'

const TRAIL = [
    { name: 'Home', href: '/en' },
    { name: 'Help', href: '/en/help' },
    { name: 'Passkeys', href: '/en/help/passkeys' },
]

describe('Breadcrumb', () => {
    test('links every crumb but the current page', () => {
        render(<Breadcrumb items={TRAIL} />)

        expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/en')
        expect(screen.getByRole('link', { name: 'Help' })).toHaveAttribute('href', '/en/help')
        expect(screen.queryByRole('link', { name: 'Passkeys' })).not.toBeInTheDocument()
        expect(screen.getByText('Passkeys')).toHaveAttribute('aria-current', 'page')
    })

    test('names the nav landmark so localized pages can translate it', () => {
        render(<Breadcrumb items={TRAIL} label="Ruta de navegación" />)

        expect(screen.getByRole('navigation', { name: 'Ruta de navegación' })).toBeInTheDocument()
    })
})
