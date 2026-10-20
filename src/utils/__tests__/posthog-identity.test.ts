import posthog from 'posthog-js'
import { identifyAnalyticsUser } from '../posthog-identity'

jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { get_distinct_id: jest.fn(), identify: jest.fn(), setPersonProperties: jest.fn() },
}))

const ph = jest.mocked(posthog)
const props = { username: 'ana', totalPoints: 10 }

describe('identifyAnalyticsUser', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        localStorage.clear()
    })

    it('identifies when the distinct id is not this user yet (login)', () => {
        ph.get_distinct_id.mockReturnValue('anon-123')
        identifyAnalyticsUser('user-1', props)
        expect(ph.identify).toHaveBeenCalledWith('user-1', props)
        expect(ph.setPersonProperties).not.toHaveBeenCalled()
    })

    it('sends nothing on a refetch with the same user and the same properties', () => {
        ph.get_distinct_id.mockReturnValue('anon-123')
        identifyAnalyticsUser('user-1', props)
        ph.get_distinct_id.mockReturnValue('user-1')
        identifyAnalyticsUser('user-1', { ...props })
        identifyAnalyticsUser('user-1', { ...props })
        expect(ph.identify).toHaveBeenCalledTimes(1)
        expect(ph.setPersonProperties).not.toHaveBeenCalled()
    })

    it('sends nothing on a later app open when the properties have not changed', () => {
        ph.get_distinct_id.mockReturnValue('user-1')
        identifyAnalyticsUser('user-1', props)
        expect(ph.setPersonProperties).toHaveBeenCalledTimes(1)
        // a new document: posthog-js forgot its last $set, localStorage did not
        identifyAnalyticsUser('user-1', props)
        expect(ph.setPersonProperties).toHaveBeenCalledTimes(1)
        expect(ph.identify).not.toHaveBeenCalled()
    })

    it('sets person properties only when one of them changed', () => {
        ph.get_distinct_id.mockReturnValue('user-1')
        identifyAnalyticsUser('user-1', props)
        identifyAnalyticsUser('user-1', { ...props, totalPoints: 11 })
        expect(ph.setPersonProperties).toHaveBeenCalledTimes(2)
        expect(ph.setPersonProperties).toHaveBeenLastCalledWith({ ...props, totalPoints: 11 })
        expect(ph.identify).not.toHaveBeenCalled()
    })

    it('identifies again after a logout reset gave PostHog a new anonymous id', () => {
        ph.get_distinct_id.mockReturnValue('user-1')
        identifyAnalyticsUser('user-1', props)
        ph.get_distinct_id.mockReturnValue('anon-after-reset')
        identifyAnalyticsUser('user-1', props)
        expect(ph.identify).toHaveBeenCalledWith('user-1', props)
    })
})
