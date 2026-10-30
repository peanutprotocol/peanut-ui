import { render, screen } from '@testing-library/react'
import { HomeRequestFold } from '../HomeRequestFold'
import type { HomeRequestStrings } from '../homeFolds.types'

jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: null }), useOptionalAuth: () => ({ user: null }) }))
jest.mock('@/hooks/useMigrationFlag', () => ({ useMigrationFlag: () => true }))
jest.mock('@/components/Migration/AppModalProvider', () => ({ useAppModal: () => () => false }))

const ES_AR: HomeRequestStrings = {
    heading: 'Solo mandá un link.',
    requesting: '{username} te está pidiendo',
    paid: 'Pagado',
    chatLabel: 'Chat: {main} manda un link de cobro de Peanut por {amount}; {payer} pagó',
}

describe('HomeRequestFold', () => {
    it('titles the fold with one short h2 that names no payer', () => {
        render(<HomeRequestFold strings={ES_AR} locale="es-ar" />)
        expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(/^Solo mandá un link\.$/)
    })

    it('names the strips in the page language, with the persona and amount filled in', () => {
        render(<HomeRequestFold strings={ES_AR} locale="es-ar" />)
        // in Argentina a bare "$" is pesos, so the dollar amount carries "USD" (Intl joins it with a no-break space)
        expect(
            screen.getByRole('img', {
                name: 'Chat: Fulano manda un link de cobro de Peanut por USD\u00a0250; Mengano pagó',
            })
        ).toBeInTheDocument()
        expect(screen.getByText('fulano te está pidiendo')).toBeInTheDocument()
        expect(screen.getByText('Pagado')).toBeInTheDocument()
    })

    it('keeps the feature link outside the two decorative request beats', () => {
        const { container } = render(<HomeRequestFold strings={ES_AR} locale="es-ar" />)
        const link = screen.getByRole('link')
        expect(link).toHaveAttribute('href', '/request-links')
        expect(link).toHaveAttribute('hrefLang', 'en')
        expect(link.closest('[aria-hidden], [role="img"]')).toBeNull()
        expect(container.querySelector('[role="img"] a, button')).toBeNull()
        // the star-LP "where do I pay you?" beat stays out
        expect(screen.queryByText('Where do I pay you?')).not.toBeInTheDocument()
    })
})
