// Gate for design.md "drawers never show a close X" (ruled 2026-10-28, kush):
// a bottom drawer closes by swipe, overlay tap, back, or its own ctas. A close
// X belongs to the centered modal only. This test fails the build when a file
// that renders DrawerContent also renders a `cancel` icon.
//
// Detection reads source text per file, so a clear-search or remove-chip X in a
// child component (SearchInput, CountryCombobox) is not flagged: those clear a
// field, they do not close the sheet. A drawer file that needs one inline goes
// on EXEMPT with its reason.

import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const SRC = join(__dirname, '..', '..', '..', '..')

// Paths relative to src/. Each entry needs a reason.
const EXEMPT = new Set<string>([])

const CANCEL_ICON = /(?:icon|name)=\{?\s*['"]cancel['"]/g

function findCloseX(text: string): number[] {
    if (!text.includes('DrawerContent')) return []
    return [...text.matchAll(CANCEL_ICON)].map((m) => m.index ?? 0)
}

function* walk(dir: string): Generator<string> {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name)
        if (entry.isDirectory()) {
            if (entry.name !== 'node_modules') yield* walk(p)
        } else yield p
    }
}

describe('drawers never show a close X', () => {
    it('flags a cancel icon only in a file that renders a drawer', () => {
        const drawer = `
            <DrawerContent>
                <Button variant="ghost" icon="cancel" aria-label={tCommon('close')} />
                <Icon name="cancel" size={20} />
                <Icon name="check" />
            </DrawerContent>`
        expect(findCloseX(drawer)).toHaveLength(2)
        expect(findCloseX(`<Modal><Icon name="cancel" /></Modal>`)).toHaveLength(0)
    })

    it('finds no close X in any drawer in src/', () => {
        const offenders: string[] = []
        for (const p of walk(SRC)) {
            if (!p.endsWith('.tsx') || /\.test\.tsx$/.test(p)) continue
            const rel = relative(SRC, p).split(sep).join('/')
            if (EXEMPT.has(rel)) continue
            const text = readFileSync(p, 'utf8')
            for (const at of findCloseX(text)) offenders.push(`${rel}:${text.slice(0, at).split('\n').length}`)
        }
        expect(offenders).toEqual([])
    })
})
