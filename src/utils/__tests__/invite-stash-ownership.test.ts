/** @jest-environment node */
// invite-stash.ts is the only owner of the invite hand-off storage. Readers
// that went around it — SignTestTransaction and the deferred-link builder read
// the `inviteCode` cookie directly — are how a storage change could leave one
// path on the old store. This scan fails the moment a second reader appears.
import { readdirSync, readFileSync } from 'fs'
import { join, relative } from 'path'

const SRC = join(__dirname, '..', '..')
const OWNER = join('utils', 'invite-stash.ts')

const FORBIDDEN: Array<{ pattern: RegExp; why: string }> = [
    {
        pattern:
            /(getFromCookie|saveToCookie|removeFromCookie|Cookies\.(get|set|remove))\(\s*['"`]invite(Code|Type|AttributionUserId)['"`]/,
        why: 'invite cookies are gone — iOS WKWebView loses them; read through invite-stash',
    },
    {
        pattern: /['"`]peanut:invite-stash['"`]|INVITE_STASH_STORAGE_KEY/,
        why: 'the stash record is private to invite-stash.ts',
    },
]

function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(path)
        return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name) ? [path] : []
    })
}

describe('invite stash ownership', () => {
    it('no module outside invite-stash.ts touches the invite hand-off storage', () => {
        const offenders = sourceFiles(SRC)
            .filter((path) => relative(SRC, path) !== OWNER)
            .flatMap((path) => {
                const source = readFileSync(path, 'utf8')
                return FORBIDDEN.filter(({ pattern }) => pattern.test(source)).map(
                    ({ why }) => `${relative(SRC, path)}: ${why}`
                )
            })

        expect(offenders).toEqual([])
    })
})
