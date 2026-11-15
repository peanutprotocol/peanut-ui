/** Bind the frozen Vitest vocabulary to the project's Jest runner. */
declare module 'vitest' {
    export const describe: typeof globalThis.describe
    export const it: typeof globalThis.it
    export const expect: typeof globalThis.expect
}
