// Gate for design.md "dismiss and defer actions" (ruled 2026-09-25, hugo):
// cancel, not now, do this later, skip, keep, close and go back are the
// tertiary LinkButton under the primary — ActionModal's `tertiaryCta`, or a
// LinkButton in a drawer or screen. A secondary or ghost Button gave them the
// weight of a second path. This test fails the build when one comes back.
//
// Detection reads source text, so it only knows the i18n keys below. A dismiss
// label under a new key is not caught — add the key here when you add one.
// A dismiss that is the ONLY action stays the single primary CTA, so a primary
// (or variant-less) Button is never flagged.

import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const SRC = join(__dirname, '..', '..', '..', '..')

// Last segment of the i18n key: t('bridgeTos.notNow') and tCommon('notNow') both match.
const DISMISS_KEYS = [
    'backToHome',
    'cancel',
    'close',
    'continueVerifying',
    'dismiss',
    'doLater',
    'doThisLater',
    'goBack',
    'keepCard',
    'maybeLater',
    'notNow',
    'notNowCta',
    'remindLater',
    'skip',
    'skipForNow',
]
// Paths relative to src/. Each entry needs a reason.
const EXEMPT = new Set<string>([
    // the setup flow's header "Skip" sits in the nav row beside back and log
    // out, not under a primary CTA; its shape is waiting on a design ruling
    'components/Setup/components/SetupWrapper.tsx',
])

const DISMISS_LABEL_RE = new RegExp(`\\(\\s*'(?:[\\w-]+\\.)*(?:${DISMISS_KEYS.join('|')})'`)
const WEAK_VARIANT_OBJECT_RE = /\bvariant:\s*'(?:secondary|ghost)'/
const WEAK_VARIANT_JSX_RE = /\bvariant=(?:"|\{\s*')(?:secondary|ghost)['"]/

/** Index of the brace that closes the one opened at `open`, skipping quoted text. */
const matchBrace = (text: string, open: number): number => {
    let depth = 0
    let quote: string | null = null
    for (let i = open; i < text.length; i++) {
        const c = text[i]
        if (quote) {
            if (c === '\\') i++
            else if (c === quote) quote = null
            continue
        }
        if (c === "'" || c === '"' || c === '`') quote = c
        else if (c === '{') depth++
        else if (c === '}' && --depth === 0) return i
    }
    return -1
}

/** Index of the brace that opens the object literal around `at`. */
const enclosingBrace = (text: string, at: number): number => {
    let depth = 0
    for (let i = at; i >= 0; i--) {
        if (text[i] === '}') depth++
        else if (text[i] === '{' && depth-- === 0) return i
    }
    return -1
}

/** Only the object's own fields: nested bodies such as `onClick: () => {…}` are cut out. */
const topLevelFields = (object: string): string => {
    let out = ''
    for (let i = 1; i < object.length - 1; i++) {
        if (object[i] === '{') {
            i = matchBrace(object, i)
            if (i === -1) break
            continue
        }
        out += object[i]
    }
    return out
}

/** `{ text: t('…cancel'), variant: 'secondary' }` — a cta entry or any object literal. */
const findWeakDismissObjects = (text: string): number[] => {
    const hits: number[] = []
    for (const match of text.matchAll(/\btext:\s*/g)) {
        const valueStart = match.index! + match[0].length
        const label = text.slice(valueStart, valueStart + 160).split(/,\s*\n|\n\s*\w+:/)[0]
        if (!DISMISS_LABEL_RE.test(label)) continue
        const open = enclosingBrace(text, match.index!)
        const close = open === -1 ? -1 : matchBrace(text, open)
        if (close === -1) continue
        if (WEAK_VARIANT_OBJECT_RE.test(topLevelFields(text.slice(open, close + 1)))) hits.push(match.index!)
    }
    return hits
}

/** `<Button variant="secondary">{t('…cancel')}</Button>` — the label in the children, not in an aria-label. */
const findWeakDismissButtons = (text: string): number[] => {
    const hits: number[] = []
    for (const match of text.matchAll(/<Button\b/g)) {
        // the opening tag ends at the first `>` outside braces and quotes
        let end = -1
        let quote: string | null = null
        for (let i = match.index! + 7, depth = 0; i < text.length; i++) {
            const c = text[i]
            if (quote) {
                if (c === quote) quote = null
                continue
            }
            if (c === '"' || c === "'" || c === '`') quote = c
            else if (c === '{') depth++
            else if (c === '}') depth--
            else if (c === '>' && depth === 0) {
                end = i
                break
            }
        }
        if (end === -1 || text[end - 1] === '/') continue
        const openingTag = text.slice(match.index!, end)
        const closing = text.indexOf('</Button>', end)
        if (closing === -1) continue
        if (WEAK_VARIANT_JSX_RE.test(openingTag) && DISMISS_LABEL_RE.test(text.slice(end, closing))) {
            hits.push(match.index!)
        }
    }
    return hits
}

function* walk(dir: string): Generator<string> {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
        const p = join(dir, entry.name)
        if (entry.isDirectory()) yield* walk(p)
        else yield p
    }
}

describe('dismiss and defer actions are the tertiary LinkButton', () => {
    it('flags a dismiss label on a secondary or ghost Button, and nothing else', () => {
        const ctas = `ctas={[
            { text: t('advisory.completeNow'), variant: 'primary', onClick: () => { go() } },
            {
                text: t('advisory.doLater'),
                onClick: () => {
                    later()
                },
                variant: 'secondary',
            },
            { text: tCommon('close'), shadowSize: '4', onClick: onClose },
            { text: t('actions.cancelRequest'), variant: 'secondary', onClick: cancelRequest },
        ]}`
        expect(findWeakDismissObjects(ctas)).toHaveLength(1)

        const buttons = `
            <Button variant="secondary" onClick={onClose}>{t('notNow')}</Button>
            <Button variant={'ghost'} className="w-auto">{tCommon('cancel')}</Button>
            <Button variant="ghost" aria-label={tCommon('close')} icon="cancel" />
            <Button variant="ghost" aria-label={tCommon('close')} onClick={() => close()}><Icon name="cancel" /></Button>
            <Button variant="primary" onClick={onBack}>{t('pix.goBack')}</Button>
            <LinkButton onClick={onClose}>{t('notNow')}</LinkButton>`
        expect(findWeakDismissButtons(buttons)).toHaveLength(2)
    })

    it('finds no dismiss action rendered as a secondary or ghost Button in src/', () => {
        const offenders: string[] = []
        for (const p of walk(SRC)) {
            if (!p.endsWith('.tsx') || /\.test\.tsx$/.test(p)) continue
            const text = readFileSync(p, 'utf8')
            const rel = relative(SRC, p).split(sep).join('/')
            if (EXEMPT.has(rel)) continue
            for (const at of [...findWeakDismissObjects(text), ...findWeakDismissButtons(text)]) {
                offenders.push(`${rel}:${text.slice(0, at).split('\n').length}`)
            }
        }
        expect(offenders).toEqual([])
    })
})
