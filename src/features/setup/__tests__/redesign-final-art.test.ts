/** @jest-environment node */
/**
 * P4-60: no art drawn in code on 09–12 (FLEET work rules, design.md § assets). Scans the screens' source, not the
 * tests: no inline SVG shapes, no canvas, no CSS-shape art, icons only through the app's Icon.
 */
import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '../../../components/Setup/redesign')
const FOLDERS = ['Email', 'Notifications', 'FinalConfirm', 'Celebration']

const sources = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
        const path = join(dir, name)
        if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sources(path)
        return /\.(tsx?|css)$/.test(name) ? [path] : []
    })

const FILES = FOLDERS.flatMap((folder) => sources(join(ROOT, folder)))

const RULES: Array<[string, RegExp]> = [
    ['inline <svg>', /<svg[\s>]/],
    ['SVG shape element', /<(path|line|circle|rect|ellipse|polygon|polyline)[\s/>]/],
    ['canvas', /<canvas[\s>]|getContext\(/],
    ['CSS shape (clip-path / gradient art)', /clip-?path|clipPath|conic-gradient|radial-gradient/],
    ['icon set outside the app Icon', /from ['"](lucide-react|react-icons|@heroicons)[^'"]*['"]/],
]

it('P4-60 finds the screen sources', () => {
    for (const folder of FOLDERS) expect(FILES.some((file) => file.includes(`/${folder}/`))).toBe(true)
})

it.each(RULES)('P4-60 no %s in 09–12 screen code', (_, rule) => {
    const hits = FILES.filter((file) => rule.test(readFileSync(file, 'utf8')))
    expect(hits).toEqual([])
})
