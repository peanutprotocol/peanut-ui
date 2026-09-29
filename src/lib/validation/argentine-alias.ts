import { hasEnsNamespace } from './ens'

/** Shape of a BCRA "alias CBU/CVU": 6-20 letters, digits, dots and dashes. */
const ALIAS_SHAPE = /^[a-z\d.-]{6,20}$/i

/**
 * A typed Argentine payment alias. Peanut cannot pay one, so both the
 * recipient field and the QR scanner answer with the merchant-QR guidance
 * rather than looking it up.
 *
 * A dot is required — without one an alias cannot be told apart from a Peanut
 * username. Names in a namespace the resolver serves are never claimed, so a
 * string that is both (an alias under the `.mp` ccTLD) is read as a name.
 *
 * Pure on purpose: the QR recognizer reuses it and must not pull in the
 * network-backed recipient classifier.
 */
export const isArgentinePaymentAlias = (value: string): boolean => {
    const alias = value.trim()
    return alias.includes('.') && ALIAS_SHAPE.test(alias) && !hasEnsNamespace(alias)
}
