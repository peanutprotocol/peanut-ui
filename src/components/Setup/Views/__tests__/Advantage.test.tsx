/** @jest-environment jsdom */
import { fireEvent, screen } from '@testing-library/react'
import posthog from 'posthog-js'
import { renderWithIntl } from '@/test-utils/intl'
import { onSignupScreen, signupControls } from '@/test-utils/signup-controls'
import AdvantageStep from '../Advantage'

const mockNext = jest.fn(async () => {})
jest.mock('@/hooks/useSetupFlow', () => ({ useSetupFlow: () => ({ handleNext: mockNext, isLoading: false }) }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))

it.each(['advantage-fees', 'advantage-card'] as const)('reports Continue on %s and moves on', (screenId) => {
    ;(posthog.capture as jest.Mock).mockClear()
    renderWithIntl(onSignupScreen(screenId, <AdvantageStep />))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(mockNext).toHaveBeenCalled()
    expect(signupControls(posthog.capture as jest.Mock)).toEqual(['continue:tap'])
    expect((posthog.capture as jest.Mock).mock.calls[0][1].screen_id).toBe(screenId)
})
