import { render, screen } from '@testing-library/react'
import KycPrepChecklist from '../KycPrepChecklist'

jest.mock('next-intl', () => ({
    useTranslations: () => (key: string) => key,
}))

const orderOf = (...testids: string[]) => {
    const list = screen.getByTestId('kyc-prep-checklist')
    const nodes = [...list.querySelectorAll('*')]
    return testids.map((id) => nodes.findIndex((node) => node.textContent?.trim() === id))
}

describe('KycPrepChecklist', () => {
    /*
     * Device feedback 2026-09-04: the "one more document may be asked for" note
     * qualifies the requirements list, so it reads directly under it; duration
     * closes the block. It used to sit after "how long", which split the two
     * statements about documents with an unrelated one about time.
     */
    it('puts the extra-document note above the how-long block', () => {
        render(<KycPrepChecklist path="standard" />)
        const [note, howLong] = orderOf('extraDocNote', 'howLongLabel')
        expect(note).toBeGreaterThanOrEqual(0)
        expect(howLong).toBeGreaterThanOrEqual(0)
        expect(note).toBeLessThan(howLong)
    })

    it('drops the extra-document note on the hosted path', () => {
        render(<KycPrepChecklist path="hosted" />)
        expect(screen.queryByText('extraDocNote')).not.toBeInTheDocument()
        expect(screen.getByText('howLongLabel')).toBeInTheDocument()
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
