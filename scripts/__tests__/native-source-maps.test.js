const fs = require('fs')
const os = require('os')
const path = require('path')
const { processNativeSourceMaps, sourceMaps } = require('../native-source-maps')
const { execFileSync } = require('child_process')

let root
let assets
beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'native-maps-'))
    assets = path.join(root, 'out', '_next', 'static', 'chunks')
    fs.mkdirSync(assets, { recursive: true })
    fs.writeFileSync(path.join(assets, 'app.js'), 'console.log("app")')
    fs.writeFileSync(path.join(assets, 'app.js.map'), '{}')
})
afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

it('injects and uploads the shipped assets with the runtime release, then removes maps', () => {
    const run = jest.fn().mockReturnValue('abc1234\n')
    processNativeSourceMaps({ root, env: { SENTRY_AUTH_TOKEN: 'test', SENTRY_NATIVE_UPLOAD_REQUIRED: 'true' }, run })
    expect(run.mock.calls[1][1]).toEqual(['sourcemaps', 'inject', path.dirname(assets)])
    expect(run.mock.calls[2][1]).toContain('abc1234')
    expect(run.mock.calls[2][1]).toContain('--validate')
    expect(sourceMaps(path.join(root, 'out'))).toEqual([])
    expect(fs.existsSync(path.join(assets, 'app.js'))).toBe(true)
})

it('fails a release on upload failure and still removes private source', () => {
    const run = jest
        .fn()
        .mockReturnValueOnce('abc1234')
        .mockImplementation(() => {
            throw new Error('upload failed')
        })
    expect(() => processNativeSourceMaps({ root, env: { SENTRY_AUTH_TOKEN: 'test' }, run })).toThrow('upload failed')
    expect(sourceMaps(path.join(root, 'out'))).toEqual([])
})

it('requires credentials and source maps for release lanes', () => {
    expect(() => processNativeSourceMaps({ root, env: { SENTRY_NATIVE_UPLOAD_REQUIRED: 'true' } })).toThrow(
        'SENTRY_AUTH_TOKEN'
    )
    expect(() => processNativeSourceMaps({ root, env: { SENTRY_NATIVE_UPLOAD_REQUIRED: 'true' } })).toThrow(
        'source maps missing'
    )
})

it('allows local and PR builds without credentials while removing their maps', () => {
    const run = jest.fn()
    processNativeSourceMaps({ root, env: {}, run, warn: jest.fn() })
    expect(run).not.toHaveBeenCalled()
    expect(sourceMaps(path.join(root, 'out'))).toEqual([])
})

it('the installed CLI links hidden maps and JavaScript with the same debug ID', () => {
    const file = path.join(assets, 'app.js')
    fs.writeFileSync(
        `${file}.map`,
        JSON.stringify({
            version: 3,
            file: 'app.js',
            sources: ['app.ts'],
            sourcesContent: ['console.log("app")'],
            names: [],
            mappings: 'AAAA',
        })
    )
    execFileSync(
        path.join(__dirname, '..', '..', 'node_modules', '.bin', 'sentry-cli'),
        ['sourcemaps', 'inject', assets],
        { stdio: 'pipe' }
    )
    const map = JSON.parse(fs.readFileSync(`${file}.map`, 'utf8'))
    const js = fs.readFileSync(file, 'utf8')
    expect(map.debugId).toMatch(/^[0-9a-f-]{36}$/)
    expect(js).toContain(map.debugId)
    expect(js).toContain('_sentryDebugIds')
    expect(js).not.toContain('sourceMappingURL=')
})
