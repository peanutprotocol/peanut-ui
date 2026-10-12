const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawn, spawnSync } = require('child_process')

const repoRoot = path.resolve(__dirname, '../..')
const sdkVersion = require('../../package.json').dependencies['@sumsub/cordova-idensic-mobile-sdk-plugin']

describe('iOS Sumsub framework compatibility', () => {
    let root
    const write = (name, contents) => {
        const file = path.join(root, name)
        fs.mkdirSync(path.dirname(file), { recursive: true })
        fs.writeFileSync(file, contents)
    }
    const plugin = 'ios/capacitor-cordova-ios-plugins/sources/SumsubCordovaIdensicMobileSdkPlugin'
    const marker = `${plugin}/Frameworks/sumsub-version.txt`
    const framework = (prefix, version) => {
        write(`${prefix}/Info.plist`, '<plist>fixture</plist>')
        write(`${prefix}/ios-arm64/IdensicMobileSDK.framework/IdensicMobileSDK`, 'framework binary')
        if (version) write(`${path.dirname(prefix)}/sumsub-version.txt`, version)
    }
    const run = () =>
        spawnSync(process.execPath, [path.join(root, 'scripts/native-ios-postsync.js')], {
            encoding: 'utf8',
            env: testEnv(),
        })

    const testEnv = () => ({
        ...process.env,
        PATH: `${root}/bin:${process.env.PATH}`,
        IOS_MARKETING_VERSION: '',
        MEAWALLET_NEXUS_USER: '',
        MEAWALLET_NEXUS_PASSWORD: '',
    })
    const archive = () => {
        const result = spawnSync('zip', ['-qr', path.join(root, 'sdk.zip'), '.'], { cwd: path.join(root, 'download') })
        expect(result.status).toBe(0)
    }

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'peanut-ios-sdk-'))
        write('package.json', JSON.stringify({ version: '1.0.53' }))
        for (const name of ['native-ios-postsync.js', 'marketing-version.js']) {
            write(`scripts/${name}`, fs.readFileSync(path.join(repoRoot, 'scripts', name)))
        }
        write('ios/App/App.xcodeproj/project.pbxproj', 'MARKETING_VERSION = 1.0.53;')
        write('ios/App/CapApp-SPM/Package.swift', 'SumsubCordovaIdensicMobileSdkPlugin')
        write(`${plugin}/Package.swift`, 'IdensicMobileSDK')
        write('node_modules/@sumsub/cordova-idensic-mobile-sdk-plugin/package.json', '{}')
        write(
            'node_modules/@sumsub/cordova-idensic-mobile-sdk-plugin/plugin.xml',
            `<pod name="IdensicMobileSDK" spec="=${sdkVersion}" />`
        )
        write(
            'bin/curl',
            `#!${process.execPath}
const fs = require('fs')
const path = require('path')
const root = path.resolve(__dirname, '..')
if (fs.existsSync(path.join(root, 'fail-download'))) process.exit(7)
if (fs.existsSync(path.join(root, 'gate-download'))) {
    fs.writeFileSync(path.join(root, 'download-started'), '')
    const deadline = Date.now() + 5000
    while (!fs.existsSync(path.join(root, 'release-download'))) {
        if (Date.now() > deadline) process.exit(8)
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20)
    }
}
fs.copyFileSync(path.join(root, 'sdk.zip'), process.argv[process.argv.indexOf('-o') + 1])
`
        )
        fs.chmodSync(path.join(root, 'bin/curl'), 0o755)
    })

    afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

    it('reuses a framework only when its version matches the installed plugin', () => {
        write(
            'node_modules/@sumsub/cordova-idensic-mobile-sdk-plugin/plugin.xml',
            `<pod name="IdensicMobileSDK" spec="=${sdkVersion}" />`
        )
        framework(`${plugin}/Frameworks/IdensicMobileSDK.xcframework`, sdkVersion)
        const result = run()
        expect({ status: result.status, stderr: result.stderr }).toEqual({ status: 0, stderr: '' })
        expect(result.stdout).not.toContain('downloading IdensicMobileSDK')
    })

    it('refuses an installed SDK update that the vendoring script has not adopted', () => {
        write(
            'node_modules/@sumsub/cordova-idensic-mobile-sdk-plugin/plugin.xml',
            '<pod name="IdensicMobileSDK" spec="=99.0.0" />'
        )
        const result = run()
        expect(result.status).not.toBe(0)
        expect(result.stderr).toContain("does not match the installed plugin's 99.0.0")
        expect(result.stdout).not.toContain('downloading IdensicMobileSDK')
    })

    it('publishes a complete framework and its version together, then reuses it', () => {
        framework(`${plugin}/Frameworks/IdensicMobileSDK.xcframework`, 'old-version')
        framework('download/IdensicMobileSDK.xcframework')
        write('download/IdensicMobileSDK.xcframework/_CodeSignature/CodeResources', 'signature fixture')
        archive()
        const result = run()
        expect({ status: result.status, stderr: result.stderr }).toEqual({ status: 0, stderr: '' })
        expect(fs.readFileSync(path.join(root, marker), 'utf8')).toBe(sdkVersion)
        expect(fs.readdirSync(path.join(root, plugin, 'Frameworks'))).toEqual([
            'IdensicMobileSDK.xcframework',
            'sumsub-version.txt',
        ])
        expect(
            fs.existsSync(path.join(root, plugin, 'Frameworks/IdensicMobileSDK.xcframework/sumsub-version.txt'))
        ).toBe(false)
        expect(
            fs.readFileSync(
                path.join(root, plugin, 'Frameworks/IdensicMobileSDK.xcframework/_CodeSignature/CodeResources'),
                'utf8'
            )
        ).toBe('signature fixture')
        expect(fs.readdirSync(path.join(root, plugin))).toEqual(['Frameworks', 'Package.swift'])
        const repeat = run()
        expect(repeat.status).toBe(0)
        expect(repeat.stdout).not.toContain('downloading IdensicMobileSDK')
    })

    it.each(['download', 'extraction'])(
        'preserves the old cache when %s fails and permits a later retry',
        (failure) => {
            framework(`${plugin}/Frameworks/IdensicMobileSDK.xcframework`, 'old-version')
            if (failure === 'download') write('fail-download', '')
            else {
                write('download/IdensicMobileSDK.xcframework/Info.plist', '<plist>incomplete</plist>')
                archive()
            }
            expect(run().status).not.toBe(0)
            expect(fs.readFileSync(path.join(root, marker), 'utf8')).toBe('old-version')
            expect(fs.readdirSync(path.join(root, plugin, 'Frameworks'))).toEqual([
                'IdensicMobileSDK.xcframework',
                'sumsub-version.txt',
            ])
            fs.rmSync(path.join(root, 'fail-download'), { force: true })
            framework('download/IdensicMobileSDK.xcframework')
            archive()
            expect(run().status).toBe(0)
            expect(fs.readFileSync(path.join(root, marker), 'utf8')).toBe(sdkVersion)
        }
    )

    it('refuses an overlapping writer while the first download has not published', async () => {
        framework(`${plugin}/Frameworks/IdensicMobileSDK.xcframework`, 'old-version')
        framework('download/IdensicMobileSDK.xcframework')
        archive()
        write('gate-download', '')
        const first = spawn(process.execPath, [path.join(root, 'scripts/native-ios-postsync.js')], {
            env: testEnv(),
            stdio: 'ignore',
        })
        const finished = new Promise((resolve, reject) => {
            first.on('error', reject)
            first.on('close', resolve)
        })
        try {
            const deadline = Date.now() + 3000
            while (!fs.existsSync(path.join(root, 'download-started')) && Date.now() < deadline) {
                await new Promise((resolve) => setTimeout(resolve, 20))
            }
            expect(fs.existsSync(path.join(root, 'download-started'))).toBe(true)
            const second = run()
            expect(second.status).not.toBe(0)
            expect(second.stderr).toContain('Another Sumsub postsync is active')
            expect(fs.readFileSync(path.join(root, marker), 'utf8')).toBe('old-version')
        } finally {
            write('release-download', '')
            expect(await finished).toBe(0)
        }
        expect(fs.readFileSync(path.join(root, marker), 'utf8')).toBe(sdkVersion)
        expect(run().status).toBe(0)
    })
})
