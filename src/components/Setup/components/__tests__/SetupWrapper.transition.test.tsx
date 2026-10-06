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

it('slides complete screens together with only the incoming screen accessible', async () => {
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
    expect(screen.getByText('Fund your account')).toBeInTheDocument()
    const outgoing = screen.getByText('Pink card').closest('[aria-hidden="true"]')
    expect(outgoing).toHaveAttribute('aria-hidden', 'true')
    expect(outgoing).toHaveAttribute('inert')
    expect(screen.getAllByRole('heading')).toHaveLength(1)
    await waitFor(() => expect(screen.queryByText('Pink card')).not.toBeInTheDocument())
    expect(hero).not.toBeInTheDocument()
    expect(screen.getAllByRole('heading')).toHaveLength(1)
})

it('keeps the next illustration override when the outgoing screen cleans up', async () => {
    const { useSetupImageOverride } = await import('../SetupWrapper')
    const Override = ({ pose }: { pose: 'thinking' | 'cheering' }) => {
        useSetupImageOverride({ pose })
        return <h1>{pose}</h1>
    }
    const view = renderWithIntl(
        <SetupWrapper layoutType="signup" screenId="advantage-card" image={{ animation: 'card' }}>
            <Override pose="thinking" />
        </SetupWrapper>
    )
    view.rerender(
        <SetupWrapper layoutType="signup" screenId="funding-methods" image={{ animation: 'topup' }}>
            <Override pose="cheering" />
        </SetupWrapper>
    )
    await waitFor(() => expect(screen.queryByText('thinking')).not.toBeInTheDocument())
    expect(screen.getByTestId('card-illustration')).toBeInTheDocument()
})
