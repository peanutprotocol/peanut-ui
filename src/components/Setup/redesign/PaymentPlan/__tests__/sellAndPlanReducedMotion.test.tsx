/** @jest-environment jsdom */
/**
 * P3-55 (component): under reduced motion, 05–08 start no entrance and no mascot loop; every art piece is at its rest
 * pose on the first frame. (CSS keyframe animations and the 200 ms crossfade timing cannot be observed in jsdom;
 * they are left to the e2e gate.)
 */
import { waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { ScreenId } from '@/components/Setup/Setup.types'
import { AccountsScreen } from '@/components/Setup/redesign/Accounts/AccountsScreen'
import { CardScreen } from '@/components/Setup/redesign/Card/CardScreen'
import { ResidenceScreen } from '@/components/Setup/redesign/Residence/ResidenceScreen'
import { PaymentPlanScreen } from '../PaymentPlanScreen'
import { renderRedesign } from '../../Accounts/__tests__/redesignHarness'

jest.mock('@/hooks/useSetupFlow', () => ({ useSetupFlow: () => ({ handleNext: jest.fn(), isLoading: false }) }))
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: jest.fn(), setPersonProperties: jest.fn(), register: jest.fn() },
}))
jest.mock('framer-motion', () => require('../../Accounts/__tests__/framerMock').framerMotionForShell(() => true))
const mockLoadAnimation = jest.fn((_config: Record<string, unknown>) => ({
    totalFrames: 20,
    frameRate: 30,
    addEventListener: jest.fn(),
    destroy: jest.fn(),
    goToAndStop: jest.fn(),
    playSegments: jest.fn(),
}))
jest.mock('lottie-web/build/player/lottie_light', () => ({
    __esModule: true,
    default: { loadAnimation: (config: Record<string, unknown>) => mockLoadAnimation(config) },
}))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { user: { userId: 'user-1' } } }) }))
jest.mock('@/app/actions/users', () => ({ updateUserById: () => new Promise(() => undefined) }))
jest.mock('@/features/setup/useSetupCountrySignals', () => ({
    useSetupCountrySignals: () => ({ vercelIpCountry: 'AR', edgeSettled: true, ipCountry: 'AR' }),
}))
jest.mock('@/hooks/useResidenceRestrictionSets', () => ({
    ...jest.requireActual('@/hooks/useResidenceRestrictionSets'),
    useResidenceRestrictionSetsWithStatus: () => ({
        sets: jest.requireActual('@/test-utils/residenceRestrictions.fixture').RESIDENCE_RESTRICTION_SETS,
        settled: true,
    }),
}))
jest.mock('@/hooks/useKycIntents', () => ({
    useKycIntents: (country: string) => ({
        intents: jest.requireActual('@/test-utils/kycIntents.fixture').KYC_INTENTS_BY_COUNTRY[country],
        settled: true,
    }),
}))

beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query: string) => ({
            matches: query.includes('reduce'),
            media: query,
            onchange: null,
            addListener: jest.fn(),
            removeListener: jest.fn(),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            dispatchEvent: jest.fn(),
        }),
    })
})

const SCREENS: [string, ScreenId, ReactNode][] = [
    ['05', 'advantage-fees', <AccountsScreen key="05" />],
    ['06', 'advantage-card', <CardScreen key="06" />],
    ['07', 'residence', <ResidenceScreen key="07" />],
    ['08', 'payment-plan', <PaymentPlanScreen key="08" />],
]

describe('P3-55 reduced motion on 05–08', () => {
    it.each(SCREENS)('%s shows its art at rest on the first frame and loops nothing', async (_no, screenId, ui) => {
        const view = renderRedesign(ui, { screenId, seed: { residenceCountry: 'AR' } })
        const art = view.container.querySelector('[data-setup-art-layer]')
        expect(art).not.toBeNull()
        // something is drawn, and nothing is hidden waiting for an entrance
        expect(art!.querySelectorAll('[data-setup-art-box] *').length).toBeGreaterThan(0)
        for (const el of art!.querySelectorAll<HTMLElement>('[style]')) {
            expect(el.style.opacity).not.toBe('0')
        }
        // mascots hold their frame
        await waitFor(() => {
            for (const mascot of view.container.querySelectorAll('[data-lottie-running]')) {
                expect(mascot).toHaveAttribute('data-lottie-running', 'false')
            }
        })
        // coin rigs never play a pass
        for (const { value } of mockLoadAnimation.mock.results) {
            expect(value.playSegments).not.toHaveBeenCalled()
        }
    })
})
