/** @jest-environment node */
const { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } = require('node:fs')
const { spawnSync } = require('node:child_process')
const { tmpdir } = require('node:os')
const { join } = require('node:path')
const script = join(__dirname, '..', 'copy-ios-mea-config.sh')
let root
beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'ios-mea-config-'))
    mkdirSync(join(root, 'App'))
    mkdirSync(join(root, 'build', 'App.app'), { recursive: true })
})
afterEach(() => rmSync(root, { recursive: true, force: true }))
const target = () => join(root, 'build', 'App.app', 'mea_config')
const run = (required = true) =>
    spawnSync('sh', [script], {
        env: {
            ...process.env,
            SRCROOT: root,
            TARGET_BUILD_DIR: join(root, 'build'),
            UNLOCALIZED_RESOURCES_FOLDER_PATH: 'App.app',
            SWIFT_ACTIVE_COMPILATION_CONDITIONS: required ? 'OTHER PEANUT_REQUIRE_PUSH_PROVISIONING' : '',
        },
        encoding: 'utf8',
    })
test('production fails for missing or empty config', () => {
    expect(run().status).not.toBe(0)
    writeFileSync(join(root, 'App', 'mea_config'), '')
    expect(run().status).not.toBe(0)
})
test('copies config bytes into the archived bundle', () => {
    const bytes = Buffer.from([0, 1, 255, 10])
    writeFileSync(join(root, 'App', 'mea_config'), bytes)
    expect(run().status).toBe(0)
    expect(readFileSync(target())).toEqual(bytes)
})
test('a local stub build removes stale bundled config', () => {
    writeFileSync(target(), 'stale')
    expect(run(false).status).toBe(0)
    expect(existsSync(target())).toBe(false)
})
