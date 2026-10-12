/**
 * `psl` ships types at `types/index.d.ts` but its package.json `exports` map
 * declares no `types` condition, so `moduleResolution: bundler` cannot reach
 * them. Declare the one function we use until the package fixes its exports.
 */
declare module 'psl' {
    /** True when the domain sits under a suffix in the Public Suffix List. */
    export function isValid(domain: string): boolean
}
