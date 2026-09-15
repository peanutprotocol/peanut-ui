const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')

const workflowSource = fs.readFileSync(path.join(__dirname, '..', '..', '.github/workflows/ios-release.yml'), 'utf8')
const targetStripper = fs.readFileSync(path.join(__dirname, '..', 'disable-wallet-ios-targets.mjs'), 'utf8')
const renderExportOptions = path.join(__dirname, '..', 'render-ios-export-options.mjs')
const projectPath = path.join(__dirname, '..', '..', 'ios/App/App.xcodeproj/project.pbxproj')
const projectSource = fs.readFileSync(projectPath, 'utf8')
const baselineEntitlements = fs.readFileSync(
    path.join(__dirname, '..', '..', 'ios/App/App/AppReleaseBaseline.entitlements'),
    'utf8'
)

describe('iOS release workflow', () => {
    it('accepts plutil raw true for the Wallet extension entitlement', () => {
        expect(workflowSource).toContain('if [ "$PAYMENT" != "true" ]; then')
        expect(workflowSource).not.toContain('if [ "$PAYMENT" != "1" ]; then')
    })

    it('keeps unentitled iOS releases available by omitting Wallet targets', () => {
        expect(workflowSource).toContain("if: ${{ vars.IOS_WALLET_PROVISIONING_ENABLED == 'true' }}")
        expect(workflowSource).toContain('node scripts/disable-wallet-ios-targets.mjs')
        expect(workflowSource).toContain('WALLET_PROVISIONING_ENABLED')
        expect(targetStripper).toContain('Embed App Extensions phase anchor not found')
        expect(targetStripper).toContain('App target dependency anchor not found')
        expect(targetStripper).toContain('AppReleaseBaseline.entitlements')
        expect(projectSource).toContain('CODE_SIGN_ENTITLEMENTS = App/AppRelease.entitlements;')
        expect(baselineEntitlements).not.toContain('com.apple.developer.payment-pass-provisioning')
        expect(baselineEntitlements).not.toContain('keychain-access-groups')
        expect(baselineEntitlements).not.toContain('group.me.peanut.wallet</string>')

        const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'peanut-ios-project-'))
        const outputPath = path.join(directory, 'project.pbxproj')
        fs.copyFileSync(projectPath, outputPath)
        try {
            execFileSync(process.execPath, [path.join(__dirname, '..', 'disable-wallet-ios-targets.mjs')], {
                env: { ...process.env, IOS_PROJECT_FILE: outputPath },
            })
            const strippedProject = fs.readFileSync(outputPath, 'utf8')
            const embedPhase = strippedProject.match(
                /AA0000000000000000000601 \/\* Embed App Extensions \*\/[\s\S]*?files = \(([\s\S]*?)\);/
            )?.[1]
            const appDependencies = strippedProject.match(
                /504EC3031FED79650016851F \/\* App \*\/[\s\S]*?dependencies = \(([\s\S]*?)\);/
            )?.[1]
            expect(embedPhase).not.toMatch(/PushProvisioningExtension/)
            expect(appDependencies).not.toMatch(/PBXTargetDependency/)
            expect(strippedProject).toContain('CODE_SIGN_ENTITLEMENTS = App/AppReleaseBaseline.entitlements;')
        } finally {
            fs.rmSync(directory, { recursive: true, force: true })
        }
    })

    it('keeps app push and Sentry validation enabled for non-Wallet releases', () => {
        const verifierStart = workflowSource.indexOf('- name: Verify push entitlements + Sentry DSN in exported IPA')
        const verifierEnd = workflowSource.indexOf('- name: Upload dSYMs to Sentry', verifierStart)
        const verifier = workflowSource.slice(verifierStart, verifierEnd)

        expect(verifier).toContain('WALLET_PROVISIONING_ENABLED')
        expect(verifier).toContain('if [ "$WALLET_PROVISIONING_ENABLED" = "true" ]; then')
        expect(verifier).toContain('aps-environment')
        expect(verifier).toContain('SentryDSN')
        expect(verifier).not.toContain("if: ${{ vars.IOS_WALLET_PROVISIONING_ENABLED == 'true' }}")
    })

    it('renders enabled Wallet profile names into valid export options', () => {
        const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'peanut-ios-export-'))
        const outputPath = path.join(directory, 'ExportOptions.plist')

        try {
            execFileSync(process.execPath, [renderExportOptions], {
                env: {
                    ...process.env,
                    APPLE_TEAM_ID: 'TEAM123',
                    PROFILE_NAME: 'Peanut Wallet App Store',
                    WALLET_PROVISIONING_ENABLED: 'true',
                    WALLET_EXTENSION_PROFILE_NAME: 'Peanut Wallet Push Provisioning Extension App Store',
                    WALLET_EXTENSION_UI_PROFILE_NAME: 'Peanut Wallet Push Provisioning Authorization App Store',
                    EXPORT_OPTIONS_PATH: outputPath,
                },
            })

            const document = new DOMParser().parseFromString(fs.readFileSync(outputPath, 'utf8'), 'application/xml')
            expect(document.querySelector('parsererror')).toBeNull()
            const values = [...document.querySelectorAll('dict > key')].map((key) => key.textContent)
            expect(values).toEqual(
                expect.arrayContaining([
                    'me.peanut.wallet',
                    'me.peanut.wallet.PushProvisioningExtension',
                    'me.peanut.wallet.PushProvisioningExtensionUI',
                ])
            )
            expect(document.documentElement.textContent).toContain(
                'Peanut Wallet Push Provisioning Extension App Store'
            )
            expect(document.documentElement.textContent).toContain(
                'Peanut Wallet Push Provisioning Authorization App Store'
            )
            expect(document.documentElement.textContent).not.toContain('${WALLET_EXTENSION_PROFILE_NAME}')
        } finally {
            fs.rmSync(directory, { recursive: true, force: true })
        }
    })
})
