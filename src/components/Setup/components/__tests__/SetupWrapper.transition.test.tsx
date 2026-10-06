import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { SetupWrapper } from '../SetupWrapper'

jest.mock('@/i18n/app/locale-context', () => ({ useAppLocale: () => ({ locale: 'en', setLocale: jest.fn() }) }))
jest.mock('@/hooks/useKeepWebBypass', () => ({ useKeepWebBypass: () => false }))
jest.mock('@/hooks/useMigrationFlag', () => ({ useMigrationFlag: () => false }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => false }))
jest.mock('@/components/0_Bruddle/CloudsBackground', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/PeanutMascot', () => ({
    __esModule: true,
    default: () => <div data-testid="card-illustration" />,
}))
// Keep real AnimatePresence and motion: this catches an outgoing header losing its hero.
jest.mock('framer-motion', () => ({ ...jest.requireActual('framer-motion'), useReducedMotion: () => false }))

it('retains the complete card layout during exit before mounting the full-screen funding heading', async () => {
    const view = renderWithIntl(
        <SetupWrapper layoutType="signup" screenId="advantage-card" image={{ pose: 'thinking' }} title="Pink card">
            <button>Next</button>
        </SetupWrapper>
    )
    const hero = screen.getByTestId('card-illustration').closest('.setup-hero-background')
    view.rerender(
        <SetupWrapper layoutType="signup" screenId="funding-methods" fullScreen>
            <h1>Fund your account</h1>
        </SetupWrapper>
    )
    expect(screen.getByText('Pink card')).toBeInTheDocument()
    expect(hero).toBeInTheDocument()
    expect(screen.queryByText('Fund your account')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Fund your account')).toBeInTheDocument())
    expect(screen.queryByText('Pink card')).not.toBeInTheDocument()
    expect(hero).not.toBeInTheDocument()
    expect(screen.getAllByRole('heading')).toHaveLength(1)
})
