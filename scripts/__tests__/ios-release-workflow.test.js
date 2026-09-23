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

})
