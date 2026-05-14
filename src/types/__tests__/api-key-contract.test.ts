import openapi from '../api.openapi.json'

// FE↔BE contract: peanut-ui auths via JWT Bearer only; `apiFetch` does not
// send an `Api-Key` header. Any route in the committed OpenAPI snapshot that
// requires `api-key` is therefore uncallable from the UI and will return
// 4xx for every user. This regression has shipped twice (PR #766 for
// /charges, PR peanut-api-ts#773 for bank/*); this test is the FE half of
// the guard. The BE half lives in peanut-api-ts at
// test/unit/api-key-leak.test.ts.
//
// The snapshot is refreshed by `pnpm gen:api:live` (curls the running API).
// If the BE drifts and an api-key requirement comes back, refreshing the
// snapshot trips this test.
//
// Allowlist: paths under /points/admin/* are intentional — chip-side scripts
// hit them with a 'points'-permission key, never the UI.

const ALLOWED_REQUIRED_PATHS = [/^\/points\/admin(\/|$)/]

type HeaderParam = { in?: string; name?: string; required?: boolean }
type Operation = { parameters?: HeaderParam[] }
type Paths = Record<string, Record<string, Operation>>

const paths = (openapi as unknown as { paths: Paths }).paths

describe('FE↔BE contract: UI-callable routes must not require api-key', () => {
    it('no route in the committed OpenAPI snapshot requires api-key (outside allowlist)', () => {
        const offenders: string[] = []
        for (const [path, methods] of Object.entries(paths)) {
            if (ALLOWED_REQUIRED_PATHS.some((re) => re.test(path))) continue
            for (const [method, op] of Object.entries(methods)) {
                if (!op || typeof op !== 'object') continue
                const params = op.parameters ?? []
                for (const p of params) {
                    if (p.in === 'header' && p.name?.toLowerCase() === 'api-key' && p.required === true) {
                        offenders.push(`${method.toUpperCase()} ${path}`)
                        break
                    }
                }
            }
        }
        expect(offenders).toEqual([])
    })
})
