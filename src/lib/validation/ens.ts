import { isValid as isPublicSuffixDomain } from 'psl'
import { normalize } from 'viem/ens'

/**
 * Size caps are ours, not an ENS rule: they bound what the app is willing to
 * put in a `GET /ens/<name>` path. Character validity is not ours to invent —
 * `normalize` applies ENSIP-15, the same check the backend resolver runs, so
 * emoji and IDN names stay valid and free text does not.
 */
const MAX_RAW_INPUT_LENGTH = 512
const MAX_NAME_LENGTH = 255
const MAX_LABEL_LENGTH = 63

/** The JustaName domain Peanut mints its own subnames under. */
const PEANUT_ENS_DOMAIN = (process.env.NEXT_PUBLIC_JUSTANAME_ENS_DOMAIN || 'peanut.me').toLowerCase()

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
    const name = value.trim().toLowerCase().replace(/\.$/, '')
    const labels = name.split('.')
    if (labels.length < 2) return false
    if (labels[labels.length - 1] === 'eth' || name.endsWith(`.${PEANUT_ENS_DOMAIN}`)) return true

    // Probe the last label alone. Asking about the whole name would reject a
    // private public suffix at its own root — `psl.isValid('github.io')` is
    // false — while `x.io` answers the question we actually have.
    return isPublicSuffixDomain(`x.${labels[labels.length - 1]}`)
}

/**
 * The ENSIP-15 form of `value`, or null when the app will not send it. The
 * return value is the exact string the resolver is asked for, so validation
 * and transport can never disagree.
 */
export const normalizeEnsName = (value: string): string | null => {
    // Cap the raw input first — before trimming, so padding cannot hide the
    // real size of what was pasted.
    if (value.length > MAX_RAW_INPUT_LENGTH) return null
    const trimmed = value.trim()
    if (!trimmed) return null

    let name: string
    try {
        // Root dot dropped first — resolvers hand back fully qualified names,
        // and the normalizer reads a trailing dot as an empty label.
        name = normalize(trimmed.replace(/\.$/, ''))
    } catch {
        return null
    }

    // Caps again on the normalized form, which is what actually goes on the
    // wire and can differ in length from the input.
    if (name.length > MAX_NAME_LENGTH) return null
    const labels = name.split('.')
    if (labels.length < 2) return null
    if (labels.some((label) => label.length > MAX_LABEL_LENGTH)) return null

    return hasEnsNamespace(name) ? name : null
}

/** Will the app send this name to the resolver? */
export const isSupportedEnsName = (value: string): boolean => normalizeEnsName(value) !== null
