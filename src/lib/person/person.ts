import type { Person, WirePerson } from './person.types'

/** The one reader of the wire field. An absent key and a null key both mean "never picked". */
export function personFrom(wire: WirePerson & { username: string }): Person
export function personFrom(wire: WirePerson | null | undefined): Person | null
export function personFrom(wire: WirePerson | null | undefined): Person | null {
    if (!wire?.username) return null // an address or a bank is not a person
    return {
        userId: wire.userId ?? null,
        username: wire.username,
        displayName: wire.showFullName && wire.fullName ? wire.fullName : wire.username,
        avatarKey: wire.avatarKey ?? null,
    } as Person // the only cast onto the brand in the codebase
}
