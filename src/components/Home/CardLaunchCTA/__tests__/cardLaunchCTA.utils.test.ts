import { dismissCardLaunchCTA, isCardLaunchCTADismissed } from '../cardLaunchCTA.utils'

describe('cardLaunchCTA dismiss persistence', () => {
    beforeEach(() => {
        localStorage.clear()
    })

    it('defaults to not dismissed', () => {
        expect(isCardLaunchCTADismissed()).toBe(false)
    })

    it('persists a dismissal', () => {
        dismissCardLaunchCTA()
        expect(isCardLaunchCTADismissed()).toBe(true)
    })

    it('is permanent — a re-read still reports dismissed (no cooldown)', () => {
        dismissCardLaunchCTA()
        // simulate a later mount reading the flag again
        expect(isCardLaunchCTADismissed()).toBe(true)
    })

    it('is idempotent', () => {
        dismissCardLaunchCTA()
        dismissCardLaunchCTA()
        expect(isCardLaunchCTADismissed()).toBe(true)
    })
})
