#!/usr/bin/env node

// Android 1.5.0 exists in two forms after the R8 repair: the original binary,
// whose Capacitor runtime annotations were stripped, and the replacement binary
// that retains them. Capgo sees only versionName, so an OTA cannot select one of
// those populations. Until a later coordinated native release advances the
// floor, every OTA must therefore remain safe on the original shell.
//
// This check is intentionally source-wide and fail-closed. Permission methods
// are forbidden in shipped JavaScript, and @capacitor/camera may only appear in
// the iOS preflight wrapper whose first executable statement returns on Android.
// Adding another permission-bearing native plugin changes the native fingerprint
// and is independently rejected by the OTA surface gate.

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CAMERA_WRAPPER = 'src/utils/camera-permission.ts'
const SOURCE_FILE = /\.(?:[cm]?[jt]sx?)$/
const TEST_FILE = /(?:^|\/)(?:__tests__|__mocks__)(?:\/|$)|\.(?:test|spec)\.[cm]?[jt]sx?$/

function git(root, args) {
    return execFileSync('git', args, {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
}

// Mask comments without destroying quoted module names or string arguments.
// The scanner only needs to distinguish executable tokens from prose; it does
// not attempt to parse JavaScript, and escaped quotes/template expressions are
// preserved conservatively so suspicious constructs are rejected rather than
// hidden.
function withoutComments(source) {
    let output = ''
    let state = 'code'
    let escaped = false

    for (let index = 0; index < source.length; index += 1) {
        const char = source[index]
        const next = source[index + 1]

        if (state === 'line-comment') {
            if (char === '\n') {
                state = 'code'
                output += '\n'
            } else {
                output += ' '
            }
            continue
        }

        if (state === 'block-comment') {
            if (char === '*' && next === '/') {
                output += '  '
                index += 1
                state = 'code'
            } else {
                output += char === '\n' ? '\n' : ' '
            }
            continue
        }

        if (state !== 'code') {
            output += char
            if (escaped) {
                escaped = false
            } else if (char === '\\') {
                escaped = true
            } else if (
                (state === 'single-quote' && char === "'") ||
                (state === 'double-quote' && char === '"') ||
                (state === 'template' && char === '`')
            ) {
                state = 'code'
            }
            continue
        }

        if (char === '/' && next === '/') {
            output += '  '
            index += 1
            state = 'line-comment'
        } else if (char === '/' && next === '*') {
            output += '  '
            index += 1
            state = 'block-comment'
        } else {
            output += char
            if (char === "'") state = 'single-quote'
            else if (char === '"') state = 'double-quote'
            else if (char === '`') state = 'template'
        }
    }

    return output
}

function productionSourcePaths(root, ref) {
    const resolvedRef = git(root, ['rev-parse', `${ref}^{commit}`])
    const resolvedHead = git(root, ['rev-parse', 'HEAD^{commit}'])
    if (resolvedRef !== resolvedHead) {
        throw new Error(`source guard ref ${ref} is ${resolvedRef}, but the checked-out tree is ${resolvedHead}`)
    }
    const dirtySource = git(root, ['status', '--porcelain', '--untracked-files=all', '--', 'src'])
    if (dirtySource) throw new Error(`source guard requires a clean src/ checkout:\n${dirtySource}`)
    return git(root, ['ls-tree', '-r', '--name-only', ref, '--', 'src'])
        .split('\n')
        .filter((path) => SOURCE_FILE.test(path) && !TEST_FILE.test(path))
}

function sourceAt(root, path) {
    return readFileSync(resolve(root, path), 'utf8')
}

function wrapperViolations(source) {
    const code = withoutComments(source)
    const violations = []
    const functionPattern =
        /export\s+async\s+function\s+ensureNativeCameraPermission\s*\([^)]*\)\s*:\s*Promise<boolean>\s*\{/
    const functionMatch = functionPattern.exec(code)
    const functionStart = functionMatch?.index ?? -1
    const functionBodyStart = functionMatch ? functionStart + functionMatch[0].length : -1
    const androidReturn = code.search(/if\s*\(\s*isAndroidNativeBridge\s*\(\s*\)\s*\)\s*return\s+true\s*;?/)
    const cameraImport = code.search(/import\s*\(\s*['"]@capacitor\/camera['"]\s*\)/)
    const cameraModuleMentions = code.match(/['"]@capacitor\/camera['"]/g)?.length ?? 0

    if (functionStart === -1) violations.push('the camera wrapper export is missing')
    if (androidReturn === -1 || (functionStart !== -1 && androidReturn < functionStart)) {
        violations.push('the camera wrapper does not return before native permission work on Android')
    }
    if (
        functionBodyStart !== -1 &&
        androidReturn !== -1 &&
        androidReturn >= functionBodyStart &&
        code.slice(functionBodyStart, androidReturn).trim()
    ) {
        violations.push("the Android return is not the wrapper's first executable statement")
    }
    if (cameraImport === -1) violations.push('the camera wrapper no longer owns the @capacitor/camera import')
    if (cameraModuleMentions !== 1) {
        violations.push('@capacitor/camera must appear exactly once as the guarded lazy import')
    }
    if (androidReturn !== -1 && cameraImport !== -1 && androidReturn > cameraImport) {
        violations.push('@capacitor/camera is reached before the Android early return')
    }
    if (
        /\bimport\s*['"]@capacitor\/camera['"]|\b(?:import|export)\b[^\n;]*\bfrom\s*['"]@capacitor\/camera['"]/.test(
            code
        )
    ) {
        violations.push('@capacitor/camera must stay a lazy import after the Android early return')
    }
    return violations
}

function generalViolations(source) {
    const code = withoutComments(source)
    const violations = []
    if (/['"]@capacitor\/camera['"]/.test(code)) {
        violations.push('@capacitor/camera is only allowed in the guarded iOS wrapper')
    }
    if (/(?:\.|\[\s*['"])(?:checkPermissions|requestPermissions)(?:['"]\s*\])?\s*\(/.test(code)) {
        violations.push('direct Capacitor permission calls are unsafe on original Android 1.5.0 binaries')
    }
    if (/\bregisterPlugin(?:\s*<[^;()]*>)?\s*\(\s*['"]Camera['"]/.test(code)) {
        violations.push('registerPlugin("Camera") bypasses the guarded iOS wrapper')
    }
    if (/\bCapacitor\s*\.\s*Plugins\s*(?:\.\s*Camera|\[\s*['"]Camera['"]\s*\])/.test(code)) {
        violations.push('Capacitor.Plugins.Camera bypasses the guarded iOS wrapper')
    }
    return violations
}

export function legacyAndroidPermissionViolations({ root = defaultRoot, ref = 'HEAD' } = {}) {
    const paths = productionSourcePaths(root, ref)
    const violations = []

    if (!paths.includes(CAMERA_WRAPPER)) {
        return [{ path: CAMERA_WRAPPER, reason: 'the guarded camera permission wrapper is missing' }]
    }

    for (const path of paths) {
        const source = sourceAt(root, path)
        const reasons = path === CAMERA_WRAPPER ? wrapperViolations(source) : generalViolations(source)
        for (const reason of reasons) violations.push({ path, reason })
    }
    return violations
}

export function checkLegacyAndroidPermissions(options = {}) {
    const violations = legacyAndroidPermissionViolations(options)
    if (violations.length > 0) {
        throw new Error(
            `legacy Android permission guard failed:\n${violations
                .map(({ path, reason }) => `  ${path}: ${reason}`)
                .join('\n')}\n` +
                'Original Android 1.5.0 binaries cannot execute Capacitor permission APIs. Cut a coordinated native release before publishing this JavaScript.'
        )
    }
    return 'legacy Android permission guard passed'
}

function flag(argv, name) {
    const index = argv.indexOf(name)
    return index === -1 ? undefined : argv[index + 1]
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
    try {
        const argv = process.argv.slice(2)
        const root = flag(argv, '--root') ?? defaultRoot
        const ref = flag(argv, '--ref') ?? 'HEAD'
        if (argv.includes('--root') && !flag(argv, '--root')) throw new Error('--root needs a directory')
        if (argv.includes('--ref') && !flag(argv, '--ref')) throw new Error('--ref needs a git ref')
        process.stdout.write(`${checkLegacyAndroidPermissions({ root, ref })}\n`)
    } catch (err) {
        console.error(`✗ legacy-android-permissions: ${err.message}`)
        process.exit(1)
    }
}
