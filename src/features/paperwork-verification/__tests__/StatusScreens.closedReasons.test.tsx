/** Fix E: reason-specific copy must not attribute every restriction to residence. */
import { screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { SavedScreen } from '../components/StatusScreens'

jest.mock('@/components/Global/PeanutMascot', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Setup/components/SetupLanguageSwitcher', () => ({ SetupLanguageSwitcher: () => null }))
jest.mock('@/utils/confetti', () => ({ confettiPresets: { success: jest.fn() } }))

describe.each(['bank', 'card', 'local', 'qr'] as const)('closed %s', (feature) => {
    it.each(['us_citizen_not_supported', 'manteca_us_nationality', 'manteca_us_nationality_restricted'])(
        'explains %s as nationality rather than residence',
        (reason) => {
            renderWithIntl(<SavedScreen closed={[{ feature, reason }]} onContinue={jest.fn()} />)
            expect(screen.getByText(/(?:aren.t|isn.t) available for your nationality/i)).toBeVisible()
            expect(screen.queryByText(/where you live/i)).not.toBeInTheDocument()
        }
    )

    it.each(['tax_id_required', 'invalid_tax_id'])('explains %s as a tax ID requirement', (reason) => {
        renderWithIntl(<SavedScreen closed={[{ feature, reason }]} onContinue={jest.fn()} />)
        expect(screen.getByText(/need(s)? a supported tax id/i)).toBeVisible()
        expect(screen.queryByText(/where you live/i)).not.toBeInTheDocument()
    })

    it.each(['future_unknown_reason', 'partner_refusal'])(
        'keeps unknown %s neutral rather than inventing a residence cause',
        (reason) => {
            renderWithIntl(<SavedScreen closed={[{ feature, reason }]} onContinue={jest.fn()} />)
            expect(screen.getByText(/(?:aren.t|isn.t) available for your current details/i)).toBeVisible()
            expect(screen.queryByText(/where you live/i)).not.toBeInTheDocument()
            expect(screen.queryByText(/for your nationality/i)).not.toBeInTheDocument()
        }
    )

    it('explains a known residence_bank_restricted reason as residence', () => {
        renderWithIntl(
            <SavedScreen closed={[{ feature, reason: 'residence_bank_restricted' }]} onContinue={jest.fn()} />
        )
        expect(screen.getByText(/where you live/i)).toBeVisible()
        expect(screen.queryByText(/for your nationality/i)).not.toBeInTheDocument()
    })
})
