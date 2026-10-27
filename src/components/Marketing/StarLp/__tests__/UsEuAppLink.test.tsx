import { fireEvent, render, screen } from '@testing-library/react'
import { MIGRATION_SURFACES } from '@/constants/migration.consts'
import { UsEuAccountPair } from '../pages/UsEuAccountPair'
import { UsEuAppLink } from '../pages/UsEuAppLink'

const mockIntercept = jest.fn(() => true)
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: null }) }))
jest.mock('@/hooks/useMigrationFlag', () => ({ useMigrationFlag: () => true }))
jest.mock('@/components/Migration/AppModalProvider', () => ({ useAppModal: () => mockIntercept }))

beforeEach(() => mockIntercept.mockClear())

describe('UsEuAppLink surface', () => {
    it('reports the star-LP surface by default', () => {
        render(<UsEuAppLink href="/setup">art</UsEuAppLink>)
        fireEvent.click(screen.getByText('art'))
        expect(mockIntercept).toHaveBeenCalledWith(MIGRATION_SURFACES.STAR_LP, 'artwork')
    })

    it('reports the surface it is given, so home clicks stay out of the star-LP funnel', () => {
        render(
            <UsEuAppLink href="/setup" surface={MIGRATION_SURFACES.LANDING_APP_FOLD}>
                art
            </UsEuAppLink>
        )
        fireEvent.click(screen.getByText('art'))
        expect(mockIntercept).toHaveBeenCalledWith(MIGRATION_SURFACES.LANDING_APP_FOLD, 'artwork')
    })

    it('passes the surface and a width cap through the account pair', () => {
        const { container } = render(
            <UsEuAccountPair surface={MIGRATION_SURFACES.LANDING_APP_FOLD} className="lg:max-w-xl" />
        )
        const link = container.querySelector('a')!
        expect(link).toHaveAttribute('href', '/app')
        expect(link).toHaveAttribute('tabindex', '-1')
        expect(link.className).toContain('lg:max-w-xl')
        expect(link.className).not.toContain('lg:max-w-224')
        fireEvent.click(link)
        expect(mockIntercept).toHaveBeenCalledWith(MIGRATION_SURFACES.LANDING_APP_FOLD, 'artwork')
    })
})
