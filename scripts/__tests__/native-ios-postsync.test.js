const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')

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
    const run = () =>
        spawnSync(process.execPath, [path.join(root, 'scripts/native-ios-postsync.js')], {
            encoding: 'utf8',
            env: { ...process.env, IOS_MARKETING_VERSION: '', MEAWALLET_NEXUS_USER: '', MEAWALLET_NEXUS_PASSWORD: '' },
        })

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
    })

    afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

    it('reuses a framework only when its version matches the installed plugin', () => {
        write(
            'node_modules/@sumsub/cordova-idensic-mobile-sdk-plugin/plugin.xml',
            `<pod name="IdensicMobileSDK" spec="=${sdkVersion}" />`
        )
        write(`${plugin}/Frameworks/IdensicMobileSDK.xcframework/fixture`, 'framework')
        write(`${plugin}/Frameworks/sumsub-version.txt`, sdkVersion)
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
})
