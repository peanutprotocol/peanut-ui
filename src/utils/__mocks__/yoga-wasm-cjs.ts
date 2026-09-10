/**
 * Jest-only shim for yoga-layout's wasm loader, which is ESM-only
 * (`import.meta.url` on line 1) and therefore unparsable in jest's CJS
 * runtime. The wasm binary itself is base64-embedded, so `import.meta.url`
 * is never actually needed to locate it — patch it out and evaluate.
 * Wired via the `yoga-wasm-base64-esm` moduleNameMapper entry.
 */
import fs from 'fs'
import path from 'path'

const entry = require.resolve('yoga-layout')
const binaryPath = path.join(path.dirname(entry), '..', 'binaries', 'yoga-wasm-base64-esm.js')
const source = fs
    .readFileSync(binaryPath, 'utf8')
    .replace('import.meta.url', 'undefined')
    .replace(/export default loadYoga;?/, 'module.exports = loadYoga;')

const shimModule = { exports: {} as { default?: unknown } }
new Function('module', 'exports', source)(shimModule, shimModule.exports)

export default shimModule.exports
