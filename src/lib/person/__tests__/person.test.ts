import { personFrom } from '../person'
import type { Person, WirePerson } from '../person.types'

describe('personFrom', () => {
    it('returns null without a username: an address or a bank is not a person', () => {
        expect(personFrom(null)).toBeNull()
        expect(personFrom(undefined)).toBeNull()
        expect(personFrom({})).toBeNull()
        expect(personFrom({ username: null, avatarKey: 'basic.cloud' })).toBeNull()
    })

    it('sets userId to null when the wire has none', () => {
        expect(personFrom({ username: 'alice' }).userId).toBeNull()
        expect(personFrom({ username: 'alice', userId: 'u1' }).userId).toBe('u1')
    })

    it('shows the full name only when the user chose to show it', () => {
        expect(personFrom({ username: 'alice', fullName: 'Alice Doe', showFullName: true }).displayName).toBe(
            'Alice Doe'
        )
        expect(personFrom({ username: 'alice', fullName: 'Alice Doe', showFullName: false }).displayName).toBe('alice')
        expect(personFrom({ username: 'alice', fullName: 'Alice Doe' }).displayName).toBe('alice')
        expect(personFrom({ username: 'alice', fullName: null, showFullName: true }).displayName).toBe('alice')
    })

    it('reads an absent key as never picked and keeps a real pick', () => {
        expect(personFrom({ username: 'alice' }).avatarKey).toBeNull()
        expect(personFrom({ username: 'alice', avatarKey: undefined }).avatarKey).toBeNull()
        expect(personFrom({ username: 'alice', avatarKey: null }).avatarKey).toBeNull()
        expect(personFrom({ username: 'alice', avatarKey: 'basic.cloud' }).avatarKey).toBe('basic.cloud')
    })

    it('types a required username as a Person and an optional one as Person | null', () => {
        const contact: { username: string; avatarKey: string | null } = { username: 'alice', avatarKey: null }
        const fromContact: Person = personFrom(contact)
        expect(fromContact.username).toBe('alice')

        const account: WirePerson = { username: 'bob' }
        const fromAccount: Person | null = personFrom(account)
        expect(fromAccount?.username).toBe('bob')
        // @ts-expect-error an optional username may be absent, so the result may be null
        const unchecked: Person = personFrom(account)
        expect(unchecked).not.toBeNull()

        // @ts-expect-error a plain literal is not a Person: only personFrom builds one
        const forged: Person = { userId: null, username: 'eve', displayName: 'eve', avatarKey: 'basic.cloud' }
        expect(forged.username).toBe('eve')
    })
})
