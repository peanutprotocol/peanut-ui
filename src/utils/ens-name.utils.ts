const PEANUT_ENS_DOMAIN = process.env.NEXT_PUBLIC_JUSTANAME_ENS_DOMAIN || ''

/**
 * Strip the Peanut JustaName subdomain suffix from an ENS primary name so it
 * renders as a plain handle (e.g. `hugo0.peanut.me.` → `hugo0`). Non-Peanut ENS
 * names pass through with the trailing dot removed.
 *
 * Deliberately kept free of `@justaname.id/*` imports: this pure string helper
 * is used by client components, and `ens.utils.ts` pulls the JustaName SDK
 * (ethers + siwe) into whatever chunk imports it.
 *
 * The root dot is removed before matching, because resolvers hand back fully
 * qualified names and the suffix check would otherwise never fire. The suffix
 * is matched on a label boundary so a name that merely ends in the same letters
 * — `notpeanut.me` — isn't truncated to `not`.
 */
export function normalizeEnsName(ensName: string | null | undefined): string | null {
    if (!ensName) return null

    const name = ensName.replace(/\.$/, '')
    const domain = PEANUT_ENS_DOMAIN.replace(/^\.+|\.+$/g, '')
    if (!domain) return name

    const suffix = `.${domain}`
    return name.endsWith(suffix) ? name.slice(0, -suffix.length) : name
}
