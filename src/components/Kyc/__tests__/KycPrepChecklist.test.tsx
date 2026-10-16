import { render, screen } from '@testing-library/react'
import KycPrepChecklist from '../KycPrepChecklist'

jest.mock('next-intl', () => ({
    useTranslations: () => (key: string) => key,
}))

describe('KycPrepChecklist', () => {
    it.each(['standard', 'extended'] as const)(
        'keeps the extra-document note without a how-long block on %s',
        (path) => {
            render(<KycPrepChecklist path={path} />)
            expect(screen.getByText('extraDocNote')).toBeInTheDocument()
            expect(screen.queryByText('howLongLabel')).not.toBeInTheDocument()
            expect(screen.queryByText(`howLong.${path}`)).not.toBeInTheDocument()
        }
    )

    it('drops the extra-document note on the hosted path', () => {
        render(<KycPrepChecklist path="hosted" />)
        expect(screen.queryByText('extraDocNote')).not.toBeInTheDocument()
        expect(screen.queryByText('howLongLabel')).not.toBeInTheDocument()
        expect(screen.getByTestId('kyc-prep-single-session')).toHaveTextContent('howLong.hosted')
    })

    /*
     * Device feedback 2026-09-17: the Argentina drawer showed a Brazilian CPF.
     * The extended path is Manteca-only, so the caller names the single country
     * and the tax-ID row shows that country's document.
     */
    it('names the Argentina tax ID when the country is AR', () => {
        render(<KycPrepChecklist path="extended" taxIdCountry="AR" />)
        expect(screen.getByText('items.taxId.bodyAR')).toBeInTheDocument()
        expect(screen.queryByText('items.taxId.bodyBR')).not.toBeInTheDocument()
        expect(screen.queryByText('items.taxId.body')).not.toBeInTheDocument()
    })

    it('names the Brazil tax ID when the country is BR', () => {
        render(<KycPrepChecklist path="extended" taxIdCountry="BR" />)
        expect(screen.getByText('items.taxId.bodyBR')).toBeInTheDocument()
        expect(screen.queryByText('items.taxId.bodyAR')).not.toBeInTheDocument()
    })

    it('falls back to the both-countries tax ID string with no country', () => {
        render(<KycPrepChecklist path="extended" />)
        expect(screen.getByText('items.taxId.body')).toBeInTheDocument()
    })
})
