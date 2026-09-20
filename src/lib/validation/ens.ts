import { isValid as isPublicSuffixDomain } from 'psl'

/**
 * Defensive input policy for the recipient field and the QR scanner. The caps
 * below are ours, not an ENS rule — they bound what the app is willing to put
 * in a `GET /ens/<name>` path, and they reject some names ENS itself accepts.
 */
const MAX_RAW_INPUT_LENGTH = 512
const MAX_NAME_LENGTH = 255
const MAX_LABEL_LENGTH = 63

/** ASCII letters, digits and hyphens, no leading or trailing hyphen. */
const LABEL_REGEX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/

/** The JustaName domain Peanut mints its own subnames under. */
const PEANUT_ENS_DOMAIN = (process.env.NEXT_PUBLIC_JUSTANAME_ENS_DOMAIN || 'peanut.me').toLowerCase()

/** Trim, lowercase and drop the root dot. This is the form we send. */
export const normalizeEnsInput = (value: string): string => value.trim().toLowerCase().replace(/\.$/, '')

/**
 * Does the tail name a namespace our resolver serves? `.eth` and the Peanut
 * subname domain are named directly; anything else has to sit under a real
 * public suffix, because ENS also resolves DNS-backed names
 * (https://docs.ens.domains/learn/dns).
 *
 * Only the suffix is judged, so a malformed name in a real namespace
 * (`test..eth`) stays an ENS name instead of becoming a payment alias.
 */
export const hasEnsNamespace = (value: string): boolean => {
    const name = normalizeEnsInput(value)
    const labels = name.split('.')
    if (labels.length < 2) return false
    if (labels[labels.length - 1] === 'eth' || name.endsWith(`.${PEANUT_ENS_DOMAIN}`)) return true

    // Probe the last label alone. Asking about the whole name would reject a
    // private public suffix at its own root — `psl.isValid('github.io')` is
    // false — while `x.io` answers the question we actually have.
    return isPublicSuffixDomain(`x.${labels[labels.length - 1]}`)
}

/** Will the app send this name to the resolver? */
export const isSupportedEnsName = (value: string): boolean => {
    // Raw cap first: trimming a padded string would otherwise slip past the
    // normalized cap below.
    if (value.length > MAX_RAW_INPUT_LENGTH) return false

    const name = normalizeEnsInput(value)
    if (!name || name.length > MAX_NAME_LENGTH) return false

    const labels = name.split('.')
    if (labels.length < 2) return false
    if (!labels.every((label) => label.length <= MAX_LABEL_LENGTH && LABEL_REGEX.test(label))) return false

    return hasEnsNamespace(name)
}
