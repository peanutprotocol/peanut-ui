import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

// design.md input anatomy: text inputs have ONE focus state, the 3px blue
// action-focus ring. a pointer-only pink focus shipped twice (ui#3041, then
// 7abe15f82 in setup) without a ruling and was reverted both times.
const SRC = join(process.cwd(), 'src')
const globalsCss = readFileSync(join(SRC, 'styles/globals.css'), 'utf8')
const PINK = /border-brand|action-primary/

const sourceFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
        const path = join(dir, name)
        if (statSync(path).isDirectory()) return sourceFiles(path)
        return /\.(tsx?|css)$/.test(name) && path !== __filename ? [path] : []
    })

describe('input focus stays the blue action-focus ring', () => {
    it('no css rule pairs focus with the pink brand colour', () => {
        const rules = [...globalsCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({
            selector: selector.trim(),
            body,
        }))
        const pinkFocus = rules.filter(
            ({ selector, body }) =>
                // plain css rules (`.x:focus { … }`) and @apply variants (`focus:border-…`)
                (/:focus/.test(selector) && PINK.test(body)) ||
                /focus(-within|-visible)?:[\w-]*(border-brand|action-primary)/.test(body)
        )
        expect(pinkFocus.map((rule) => rule.selector)).toEqual([])
    })

    it('no input-modality tracking exists to switch focus styles by pointer', () => {
        const offenders = sourceFiles(SRC).filter((file) =>
            /setupInputModality|setup-input-modality|data-input-modality|InputModalityProvider/.test(
                readFileSync(file, 'utf8')
            )
        )
        expect(offenders).toEqual([])
    })
})
