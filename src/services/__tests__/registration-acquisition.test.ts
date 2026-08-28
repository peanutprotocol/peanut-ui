import { saveToLocalStorage } from '@/utils/general.utils'
import { persistRegistrationBadgeCampaignDestination } from '../registration-acquisition'

jest.mock('@/utils/general.utils', () => ({ saveToLocalStorage: jest.fn() }))

const mockSaveToLocalStorage = saveToLocalStorage as jest.MockedFunction<typeof saveToLocalStorage>
const acquisition = { fallback: 'normal_app' as const, destination: 'offramp_migration' as const }

describe('new-registration campaign navigation', () => {
    beforeEach(() => jest.clearAllMocks())

    // every destination currently routes to /home (the offramp migration
    // surface is gone), so a confirmed claim persists nothing
    it.each(['awarded', 'already_owned'] as const)(
        'does not persist a redirect for a confirmed %s canonical claim',
        (outcome) => {
            expect(
                persistRegistrationBadgeCampaignDestination([{ badgeCampaign: 'offramp', outcome, acquisition }])
            ).toBe('/home')
            expect(mockSaveToLocalStorage).not.toHaveBeenCalled()
        }
    )

    it.each(['inactive', 'expired', 'unknown', 'definition_missing', 'retryable_error'] as const)(
        'keeps the normal app destination after %s',
        (outcome) => {
            expect(
                persistRegistrationBadgeCampaignDestination([{ badgeCampaign: 'offramp', outcome, acquisition }])
            ).toBe('/home')
            expect(mockSaveToLocalStorage).not.toHaveBeenCalled()
        }
    )

    it('does not invent a destination when a confirmed claim omits acquisition metadata', () => {
        expect(persistRegistrationBadgeCampaignDestination([{ badgeCampaign: 'offramp', outcome: 'awarded' }])).toBe(
            '/home'
        )
        expect(mockSaveToLocalStorage).not.toHaveBeenCalled()
    })
})
