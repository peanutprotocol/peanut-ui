import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { KycFeatureActivationStatus } from '../KycFeatureActivationStatus'

jest.mock('@/components/Global/PeanutMascot', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Setup/components/SetupLanguageSwitcher', () => ({ SetupLanguageSwitcher: () => null }))
jest.mock('@/utils/confetti', () => ({ confettiPresets: { success: jest.fn() } }))

describe.each(['bank', 'card', 'local'] as const)('%s first-use activation', (feature) => {
    it.each(['pending', 'setting_up'] as const)('acknowledges %s and exits', (state) => {
        const onBack = jest.fn()
        const onRetry = jest.fn()
        renderWithIntl(
            <KycFeatureActivationStatus
                feature={feature}
                result={{ kind: 'report', report: { state } }}
                isLoading={false}
                onRetry={onRetry}
                onBack={onBack}
            />
        )
        expect(screen.getByRole('heading')).toBeVisible()
        expect(screen.queryByRole('button', { name: /^done$/i })).not.toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: /^got it$/i }))
        expect(onBack).toHaveBeenCalledTimes(1)
        expect(onRetry).not.toHaveBeenCalled()
    })
})
