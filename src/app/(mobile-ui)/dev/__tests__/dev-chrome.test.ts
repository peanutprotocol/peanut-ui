import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'
import { APP_DIVERGENCE_CATEGORIES } from '../ds/audit/app/audit-app-data'
import { AUDIT_CLUSTERS, AUDIT_ITEMS } from '../ds/audit/audit-data'

const DEV_ROOT = join(__dirname, '..')
const APP_DEV_ROOT = join(DEV_ROOT, '..', '..', 'dev')
const DS_ROOT = join(DEV_ROOT, 'ds')
const SRC_ROOT = join(DEV_ROOT, '..', '..', '..')
const SHARED_DEV_ROOT = join(SRC_ROOT, 'dev')
const PAYMENT_EXPLORER_ROOT = join(SRC_ROOT, 'features', 'payment-network-explorer')

const RETIRED_CHROME = [
    'DevField',
    'DevChip',
    'DevNoteCard',
    'DevPanel',
    'DevPresetButton',
    'DevSectionLabel',
    'DevSegmented',
] as const

const UNDOCUMENTED_DS_IMPORTS = [
    '@/components/Global/EasterEggDrawer',
    '@/components/Global/EmptyStates/NoDataEmptyState',
    '@/components/Global/Modal',
] as const

const RETIRED_AUDIT_NAMES = [
    'StatusTag',
    '.label',
    'CSS .label',
    '.custom-input',
    '.text-link',
    'purple-1',
    'purple-3',
    'teal-1',
    'violet-3',
    'bg-peanut-repeat-large',
    'bg-peanut-repeat-small',
    'bg-peanut-repeat-{normal,large,small}',
    'btn-shadow (CSS',
    'brutal-border (CSS',
    'CSS .card + .card-title',
    '.th-custom-skeleton',
    '.row / .col',
    'Orphan btn-*',
    'CSS button classes — .btn-yellow',
] as const

function sourceFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name)
        if (entry.isDirectory()) return sourceFiles(path)
        return /\.(ts|tsx)$/.test(entry.name) ? [path] : []
    })
}

function rawJsxControls(sources: string[], relativeTo: string): string[] {
    const rawControls: string[] = []

    for (const path of sources) {
        const source = readFileSync(path, 'utf8')
        const sourceFile = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
        const visit = (node: ts.Node) => {
            if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
                const tag = node.tagName.getText(sourceFile)
                if (['button', 'input', 'select', 'textarea'].includes(tag)) {
                    const location = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
                    rawControls.push(`${relative(relativeTo, path)}:${location.line + 1} <${tag}>`)
                }
            }
            ts.forEachChild(node, visit)
        }
        visit(sourceFile)
    }

    return rawControls
}

function collectNames(value: unknown): string[] {
    if (Array.isArray(value)) return value.flatMap(collectNames)
    if (!value || typeof value !== 'object') return []

    const record = value as Record<string, unknown>
    return [typeof record.name === 'string' ? record.name : '', ...Object.values(record).flatMap(collectNames)].filter(
        Boolean
    )
}

describe('/dev shared chrome', () => {
    it('uses documented design-system components instead of custom visual helpers', () => {
        const sources = [...sourceFiles(DEV_ROOT), ...sourceFiles(APP_DEV_ROOT)]

        for (const component of RETIRED_CHROME) {
            expect(existsSync(join(DEV_ROOT, '_components', `${component}.tsx`))).toBe(false)

            const importPattern = new RegExp(`(?:/|\\./|\\.\\./)${component}['"]`)
            const importers = sources.filter((path) => importPattern.test(readFileSync(path, 'utf8')))
            expect(importers).toEqual([])
        }
    })

    it('keeps the design-system catalog on documented controls', () => {
        const sources = sourceFiles(DS_ROOT)
        const undocumentedImports: string[] = []

        for (const path of sources) {
            const source = readFileSync(path, 'utf8')
            for (const importPath of UNDOCUMENTED_DS_IMPORTS) {
                if (source.includes(`from '${importPath}'`) || source.includes(`from "${importPath}"`)) {
                    undocumentedImports.push(`${relative(DS_ROOT, path)} imports ${importPath}`)
                }
            }
        }

        expect(rawJsxControls(sources, DS_ROOT)).toEqual([])
        expect(undocumentedImports).toEqual([])
        expect(existsSync(join(DS_ROOT, '_components', 'StatusTag.tsx'))).toBe(false)
    })

    it('does not inventory components and CSS deleted by the design-system cleanup', () => {
        const names = collectNames([AUDIT_ITEMS, AUDIT_CLUSTERS, APP_DIVERGENCE_CATEGORIES])

        for (const retiredName of RETIRED_AUDIT_NAMES) {
            expect(names.filter((name) => name.includes(retiredName))).toEqual([])
        }
    })

    it('uses design-system controls across every dev tool shell', () => {
        const sources = [
            ...sourceFiles(DEV_ROOT),
            ...sourceFiles(APP_DEV_ROOT),
            ...sourceFiles(SHARED_DEV_ROOT),
            ...sourceFiles(PAYMENT_EXPLORER_ROOT),
        ]

        expect(rawJsxControls(sources, SRC_ROOT)).toEqual([])
    })
})
