/** @jest-environment node */

const fs = require('node:fs')
const path = require('node:path')

const workflow = fs.readFileSync(
    path.join(__dirname, '..', '..', '.github', 'workflows', 'android-release.yml'),
    'utf8'
)

describe('Android replacement release workflow', () => {
    it('fetches tags and resolves a blank direct dispatch to the current native version', () => {
        expect(workflow).toContain('fetch-depth: 0')
        expect(workflow).toContain("inputs.versionName == '' && 'production-release'")
        expect(workflow).toContain('VERSION_NAME="$(node scripts/release-version.mjs native-floor)"')
        expect(workflow).toContain('node scripts/check-native-capabilities.mjs "v$VERSION_NAME"')
    })

    it('refuses a current-version rebuild when native changes are not Android-only', () => {
        expect(workflow).toContain(
            'node scripts/check-native-change-scope.cjs "v$VERSION_NAME" android --legacy-compatible'
        )
        expect(workflow).toContain('echo "rebuild=$DIRECT_REBUILD" >> "$GITHUB_OUTPUT"')
    })

    it('allows only a same-build OTA to sort above a replacement binary', () => {
        expect(workflow).toContain('[ "$IS_REBUILD" != "true" ]')
        expect(workflow).toContain('[ "${CURRENT_CORE%.*}" != "${VERSION_NAME%.*}" ]')
        expect(workflow).toContain('Replacement build $VERSION_NAME remains covered by production OTA $CURRENT')
    })

    it('refuses to upload an optimized DEX without CameraPlugin permission metadata', () => {
        expect(workflow).toContain('Verify Capacitor permission metadata survived R8')
        expect(workflow).toContain('Lcom/getcapacitor/annotation/CapacitorPlugin; name="Camera" permissions={')
        expect(workflow).toContain('refusing to upload a crash-prone AAB')
    })

    it('records an attested replacement baseline only after the read-only release job succeeds', () => {
        const releaseJob = workflow.indexOf('    release:')
        const baselineJob = workflow.indexOf('    record-replacement-baseline:')

        expect(releaseJob).toBeGreaterThan(-1)
        expect(baselineJob).toBeGreaterThan(releaseJob)
        expect(workflow).toContain("if: needs.release.outputs.rebuild == 'true'")
        expect(workflow).toContain('peanut-native-replacement-v2: platform=android')
        expect(workflow).toContain('js-guard=android-capacitor-permissions-v1')
        expect(workflow).toContain('android-v${VERSION}-replacement-${GITHUB_SHA:0:12}')
        expect(workflow.slice(baselineJob)).toContain('contents: write')
    })
})
