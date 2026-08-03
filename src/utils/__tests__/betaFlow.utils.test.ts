import posthog from 'posthog-js'
import store from '@/redux/store'
import { getPlatform } from '@/utils/capacitor'
import { captureBetaFlow } from '@/utils/betaFlow.utils'

jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: jest.fn() },
}))
jest.mock('@/redux/store', () => ({
    __esModule: true,
    default: { getState: jest.fn() },
}))
jest.mock('@/utils/capacitor', () => ({
    getPlatform: jest.fn(),
}))

const mockCapture = posthog.capture as jest.Mock
const mockGetState = store.getState as jest.Mock
const mockGetPlatform = getPlatform as jest.Mock

const stateWithUser = (user: unknown) => ({ user: { user } })

describe('captureBetaFlow', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockGetPlatform.mockReturnValue('android-native')
    })

    it('fires beta_flow_completed with flow, platform and username as tester_id', () => {
        mockGetState.mockReturnValue(stateWithUser({ user: { username: 'zeedmozaed', userId: 'uuid-1' } }))
        captureBetaFlow('send')
        expect(mockCapture).toHaveBeenCalledWith('beta_flow_completed', {
            flow: 'send',
            platform: 'android-native',
            tester_id: 'zeedmozaed',
        })
    })

    it('falls back to userId, then anonymous, when username is missing', () => {
        mockGetState.mockReturnValue(stateWithUser({ user: { userId: 'uuid-2' } }))
        captureBetaFlow('deposit')
        expect(mockCapture).toHaveBeenLastCalledWith(
            'beta_flow_completed',
            expect.objectContaining({ tester_id: 'uuid-2' })
        )

        mockGetState.mockReturnValue(stateWithUser(null))
        captureBetaFlow('deep_link')
        expect(mockCapture).toHaveBeenLastCalledWith(
            'beta_flow_completed',
            expect.objectContaining({ tester_id: 'anonymous' })
        )
    })

    it('prefers an explicit testerId over the store', () => {
        mockGetState.mockReturnValue(stateWithUser({ user: { username: 'someone-else', userId: 'uuid-3' } }))
        captureBetaFlow('fresh_signup', 'abalinda')
        expect(mockCapture).toHaveBeenCalledWith(
            'beta_flow_completed',
            expect.objectContaining({ tester_id: 'abalinda' })
        )
    })
})
