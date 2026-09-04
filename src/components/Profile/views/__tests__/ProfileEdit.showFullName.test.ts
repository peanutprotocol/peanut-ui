import { shouldActivateShowFullName } from '../ProfileEdit.view'

describe('shouldActivateShowFullName', () => {
    it('activates when a name is set for the first time', () => {
        expect(shouldActivateShowFullName(undefined, 'Ana Gomez')).toBe(true)
        expect(shouldActivateShowFullName('', 'Ana Gomez')).toBe(true)
        expect(shouldActivateShowFullName('   ', 'Ana Gomez')).toBe(true)
        expect(shouldActivateShowFullName(null, 'Ana Gomez')).toBe(true)
    })

    /*
     * `showFullName` is a plain boolean on the wire — there is no "never
     * chose" state to read — so re-deriving it whenever a name is present
     * would silently switch it back on for someone who turned it off.
     */
    it('leaves a later edit alone, so a deliberate off survives', () => {
        expect(shouldActivateShowFullName('Ana Gomez', 'Ana G Gomez')).toBe(false)
        expect(shouldActivateShowFullName('Ana Gomez', 'Ana Gomez')).toBe(false)
    })

    it('does not activate when no name is being saved', () => {
        expect(shouldActivateShowFullName(undefined, undefined)).toBe(false)
        expect(shouldActivateShowFullName(undefined, '')).toBe(false)
        expect(shouldActivateShowFullName(undefined, '   ')).toBe(false)
    })
})
