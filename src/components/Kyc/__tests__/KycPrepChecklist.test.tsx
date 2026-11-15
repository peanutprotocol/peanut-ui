import { render, screen } from '@testing-library/react'
import KycPrepChecklist from '../KycPrepChecklist'

jest.mock('next-intl', () => ({
    useTranslations: () => (key: string) => key,
}))

describe('KycPrepChecklist', () => {
    it("lists the hosted check's documents and warns it keeps no progress", () => {
        render(<KycPrepChecklist />)
        expect(screen.getByText('items.proofOfAddress.title')).toBeInTheDocument()
        expect(screen.getByTestId('kyc-prep-single-session')).toHaveTextContent('howLong.hosted')
    })
})
