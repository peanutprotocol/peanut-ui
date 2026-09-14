import { fireEvent, render, screen } from '@testing-library/react'
import { CountriesSignUpCta } from '../CountriesSignUpCta'

const mockMigrationOn = jest.fn(() => false)
const mockIntercept = jest.fn(() => false)

jest.mock('@/hooks/useMigrationFlag', () => ({ useMigrationFlag: () => mockMigrationOn() }))
jest.mock('@/components/Migration/AppModalProvider', () => ({
    useAppModal:
        () =>
        (...args: unknown[]) =>
            mockIntercept(...(args as [])),
}))

describe('CountriesSignUpCta', () => {
    beforeEach(() => {
        mockMigrationOn.mockReturnValue(false)
        mockIntercept.mockReturnValue(false)
        mockIntercept.mockClear()
    })

    it('is the signup link it has always been with the flag off', () => {
        render(<CountriesSignUpCta label="SIGN UP" />)
        expect(screen.getByRole('link', { name: 'SIGN UP' })).toHaveAttribute('href', '/setup')
    })

    it('leaves no /setup url in the DOM with the flag on', () => {
        mockMigrationOn.mockReturnValue(true)
        render(<CountriesSignUpCta label="SIGN UP" />)
        expect(screen.getByRole('link', { name: 'SIGN UP' })).toHaveAttribute('href', '/app')
    })

    it('hands the click to the shared download modal, tagged as the countries fold', () => {
        mockMigrationOn.mockReturnValue(true)
        mockIntercept.mockReturnValue(true)
        render(<CountriesSignUpCta label="SIGN UP" />)

        const event = fireEvent.click(screen.getByRole('link', { name: 'SIGN UP' }))

        expect(mockIntercept).toHaveBeenCalledWith('landing_countries')
        // handled here, so the anchor must not also navigate
        expect(event).toBe(false)
    })
})
