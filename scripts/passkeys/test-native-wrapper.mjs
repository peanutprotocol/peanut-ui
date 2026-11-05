import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

// Exercise the patched transport with a serializer that deliberately drops app-only IDs.
const calls = []
const source = fs
    .readFileSync(path.join(process.argv[2], 'dist/esm/index.js'), 'utf8')
    .replace(/^import .*;\n/gm, '')
    .replace(/^export .*;\n/gm, '')
const context = vm.createContext({
    registerPlugin: () =>
        new Proxy(
            {},
            {
                get: (_, method) => (options) => {
                    calls.push({ method, options })
                    return Promise.resolve({ ok: true })
                },
            }
        ),
    installWebAuthnShim: () => {},
    createNativeRequest: () => ({ requestJson: '{"challenge":"fixture"}' }),
})
vm.runInContext(source + '\nglobalThis.plugin = CapacitorPasskey;', context)
await context.plugin.createCredential({ requestId: 'create_1' })
await context.plugin.getCredential({ requestId: 'get_1' })
await context.plugin.cancelRequest({ requestId: 'get_1' })
await context.plugin.getDiagnostics()
assert.equal(calls[0].options.requestId, 'create_1')
assert.equal(calls[1].options.requestId, 'get_1')
assert.equal(calls[0].options.requestJson, '{"challenge":"fixture"}')
assert.equal(calls[2].method, 'cancelRequest')
assert.equal(calls[2].options.requestId, 'get_1')
assert.equal(calls[3].method, 'getDiagnostics')
console.log('Patched ESM wrapper: 6 assertions passed')
