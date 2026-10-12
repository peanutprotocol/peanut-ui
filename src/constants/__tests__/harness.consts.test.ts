/**
 * The passkey-wall bypass must require BOTH signals — the build-time harness
 * flag AND the per-session localStorage key. A localStorage key alone, which any
 * user can set on peanut.me, must never bypass the wall (the 2026-09 security
 * fix that changed `||` to `&&`). HARNESS_ENABLED is read from the env at import,
 * so each case re-evaluates the module with the flag set or unset.
 */
// No top-level import, so mark the file a module — otherwise its consts land in
// global scope and collide with another script's globals under tsconfig.json.
export {}

const KEY = '__harness_skip_passkey'
const ENV = 'NEXT_PUBLIC_HARNESS_SKIP_PASSKEY_CHECK'

async function loadBypass(flag: boolean): Promise<() => boolean> {
    if (flag) process.env[ENV] = 'true'
    else delete process.env[ENV]
    jest.resetModules()
    const mod = await import('../harness.consts')
    return mod.harnessPasskeyBypass
}

describe('harnessPasskeyBypass', () => {
    const original = process.env[ENV]

    afterEach(() => {
        if (original === undefined) delete process.env[ENV]
        else process.env[ENV] = original
        localStorage.clear()
        jest.resetModules()
    })

    it('bypasses only when the harness flag AND the localStorage key are both set', async () => {
        localStorage.setItem(KEY, 'true')
        const harnessPasskeyBypass = await loadBypass(true)
        expect(harnessPasskeyBypass()).toBe(true)
    })

    it('does NOT bypass on the localStorage key alone — the security fix', async () => {
        localStorage.setItem(KEY, 'true')
        const harnessPasskeyBypass = await loadBypass(false)
        expect(harnessPasskeyBypass()).toBe(false)
    })

    it('does NOT bypass on the harness flag alone', async () => {
        const harnessPasskeyBypass = await loadBypass(true)
        expect(harnessPasskeyBypass()).toBe(false)
    })

    it('is false when neither signal is present', async () => {
        const harnessPasskeyBypass = await loadBypass(false)
        expect(harnessPasskeyBypass()).toBe(false)
    })
})
