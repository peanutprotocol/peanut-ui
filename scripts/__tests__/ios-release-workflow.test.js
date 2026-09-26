const fs = require('fs')
const path = require('path')

const workflowSource = fs.readFileSync(path.join(__dirname, '..', '..', '.github/workflows/ios-release.yml'), 'utf8')

describe('iOS release workflow', () => {
    it('keeps TASK-21683 profile builds inspectable without advancing production OTA', () => {
        expect(workflowSource).toContain('fetch-depth: 0')
        expect(workflowSource).toContain("github.ref_name == 'innolope/TASK-21683-lottie-native-testflight'")
        expect(workflowSource).toContain('TASK-21683 profile builds reuse the current native version')
        expect(workflowSource).toContain('NEXT_PUBLIC_LOTTIE_PROFILE_ENABLED=true')
        expect(workflowSource).toContain('KEEP_LOTTIE_PROFILE:')
        expect(workflowSource).toContain('CAPACITOR_DEBUG="$CAPACITOR_DEBUG"')
        expect(workflowSource).toContain("if: github.ref_name != 'innolope/TASK-21683-lottie-native-testflight'")
        expect(workflowSource).toContain(
            "steps.ota_floor.outputs.needs_ota == 'true' && github.ref_name != 'innolope/TASK-21683-lottie-native-testflight'"
        )
    })

    // Both the main and dev lanes call this workflow, and run_number is the caller's
    // counter, so it cannot order uploads of one version across them.
    it('numbers builds by wall clock, not the caller run number', () => {
        expect(workflowSource).not.toContain('github.run_number')
        expect(workflowSource).toContain('IOS_BUILD_NUMBER="$(node scripts/android-version-code.mjs)"')
        expect(workflowSource).toContain('CURRENT_PROJECT_VERSION="$IOS_BUILD_NUMBER"')
    })
})
