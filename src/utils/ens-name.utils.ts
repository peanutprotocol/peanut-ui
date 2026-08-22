const PEANUT_ENS_DOMAIN = process.env.NEXT_PUBLIC_JUSTANAME_ENS_DOMAIN || ''

/**
 * Strip the Peanut JustaName subdomain suffix and trailing dot from an
 * ENS primary name so it renders as a plain handle (e.g. `hugo0.peanut.me.`
 * → `hugo0`). Non-Peanut ENS names pass through with the trailing dot
 * removed.
 *
 * Deliberately kept free of `@justaname.id/*` imports: this pure string helper
 * is used by client components, and `ens.utils.ts` pulls the JustaName SDK
 * (ethers 5.7.2 + siwe, ~780 KB) into whatever chunk imports it.
 */
export function normalizeEnsName(ensName: string | null | undefined): string | null {
    if (!ensName) return null
    const stripped =
        PEANUT_ENS_DOMAIN && ensName.endsWith(PEANUT_ENS_DOMAIN) ? ensName.slice(0, -PEANUT_ENS_DOMAIN.length) : ensName
    return stripped.replace(/\.$/, '')
}
