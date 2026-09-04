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
})
