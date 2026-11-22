#!/usr/bin/env node
/**
 * Ratchet on hand-copied API enums (state-machines wave 5). A hand copy is a string-literal union
 * (a type alias or an inline field type), an `as const` array or object, or a TS enum in src/ whose 2+ values all belong to one API enum
 * (src/types/api.openapi.json `components.schemas`, generated into
 * src/constants/api-enums.generated.ts). Import the generated one instead.
 *
 *   node scripts/check-api-enum-copies.mjs                   list the copies
 *   node scripts/check-api-enum-copies.mjs --check           fail when a file has more than its baseline
 *   node scripts/check-api-enum-copies.mjs --write-baseline  lower the baseline after removing copies
 *
 * A copy that is a deliberate subset (for example the statuses one screen handles) may stay: count
 * it in the baseline, or type it as a subset of the generated type so it is no longer a literal list.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, relative, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { readApiEnums } from './generate-api-enums.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE = resolve(ROOT, 'scripts/api-enum-copies-baseline.json')
const SKIP = /(\.generated\.ts|\.d\.ts|\.test\.tsx?|__tests__|\/dev\/fixtures\/)/

function sourceFiles(dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name)
        if (entry.isDirectory())
            return entry.name === 'content' || entry.name === 'node_modules' ? [] : sourceFiles(path)
        return /\.tsx?$/.test(entry.name) && !SKIP.test(path) ? [path] : []
    })
}

/** The API enum that holds every value, or null. */
function enumHolding(values, enums) {
    if (values.length < 2) return null
    return Object.entries(enums).find(([, list]) => values.every((value) => list.includes(value)))?.[0] ?? null
}

function literalStrings(nodes) {
    const values = []
    for (const node of nodes) {
        const literal = ts.isLiteralTypeNode(node) ? node.literal : node
        if (!ts.isStringLiteral(literal)) return null
        values.push(literal.text)
    }
    return values
}

export function findCopies(file, text, enums) {
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
    const copies = []
    const record = (node, values, kind) => {
        const name = enumHolding(values, enums)
        if (name)
            copies.push({ line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1, kind, enum: name })
    }
    const visit = (node) => {
        if (ts.isUnionTypeNode(node)) {
            const values = literalStrings(node.types)
            const owner = node.parent
            const label = ts.isTypeAliasDeclaration(owner)
                ? `type ${owner.name.text}`
                : owner.name
                  ? `${owner.name.getText(source)}: union`
                  : 'union'
            if (values) record(node, values, label)
        } else if (
            ts.isAsExpression(node) &&
            ts.isTypeReferenceNode(node.type) &&
            node.type.typeName.getText(source) === 'const' &&
            ts.isArrayLiteralExpression(node.expression)
        ) {
            const values = literalStrings(node.expression.elements)
            if (values) record(node, values, 'as const array')
        } else if (
            ts.isAsExpression(node) &&
            ts.isTypeReferenceNode(node.type) &&
            node.type.typeName.getText(source) === 'const' &&
            ts.isObjectLiteralExpression(node.expression)
        ) {
            const props = node.expression.properties
            const values = props.every(ts.isPropertyAssignment) ? literalStrings(props.map((p) => p.initializer)) : null
            if (values) record(node, values, 'as const object')
        } else if (ts.isEnumDeclaration(node)) {
            const values = literalStrings(node.members.map((member) => member.initializer ?? member.name))
            if (values) record(node, values, `enum ${node.name.text}`)
        }
        ts.forEachChild(node, visit)
    }
    visit(source)
    return copies
}

function countAll() {
    const enums = readApiEnums()
    const byFile = {}
    for (const path of sourceFiles(resolve(ROOT, 'src'))) {
        const copies = findCopies(path, readFileSync(path, 'utf8'), enums)
        if (copies.length) byFile[relative(ROOT, path)] = copies
    }
    return byFile
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const byFile = countAll()
    const counts = Object.fromEntries(Object.entries(byFile).map(([file, copies]) => [file, copies.length]))
    const total = Object.values(counts).reduce((sum, n) => sum + n, 0)
    for (const [file, copies] of Object.entries(byFile)) {
        for (const copy of copies) console.log(`${file}:${copy.line} ${copy.kind} copies ${copy.enum}`)
    }
    console.log(`hand-copied API enums: ${total}`)

    if (process.argv.includes('--write-baseline')) {
        writeFileSync(BASELINE, JSON.stringify(counts, Object.keys(counts).sort(), 4) + '\n')
    } else if (process.argv.includes('--check')) {
        const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'))
        const over = Object.entries(counts).filter(([file, n]) => n > (baseline[file] ?? 0))
        for (const [file, n] of over) {
            console.error(
                `::error file=${file}::${n} hand-copied API enum(s), baseline ${baseline[file] ?? 0}. Import from @/constants/api-enums.generated instead.`
            )
        }
        const lowered = Object.entries(baseline).filter(([file, n]) => (counts[file] ?? 0) < n)
        if (lowered.length) console.log('fewer copies than the baseline: run with --write-baseline to lock the gain in')
        if (over.length) process.exit(1)
    }
}
