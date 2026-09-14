const fs = require('fs')
const path = require('path')

const rules = fs.readFileSync(path.join(__dirname, '..', '..', 'android', 'app', 'proguard-rules.pro'), 'utf8')
const resourceKeep = fs.readFileSync(
    path.join(__dirname, '..', '..', 'android', 'app', 'src', 'main', 'res', 'raw', 'me_peanut_wallet_keep.xml'),
    'utf8'
)

describe('Android release shrinker rules', () => {
    it('preserves the Capacitor permission annotations read at runtime', () => {
        expect(rules).toMatch(/-keepattributes\s+RuntimeVisibleAnnotations,AnnotationDefault/)
        expect(rules).toMatch(/-keep\s+@interface\s+com\.getcapacitor\.annotation\.CapacitorPlugin\s+\{\s*\*;\s*\}/)
        expect(rules).toMatch(/-keep\s+@interface\s+com\.getcapacitor\.annotation\.Permission\s+\{\s*\*;\s*\}/)
    })

    it('preserves the credential-gated Google Pay bridge loaded by reflection', () => {
        expect(rules).toMatch(
            /-keep,allowoptimization\s+class\s+me\.peanut\.wallet\.PushProvisioningPlugin\s+\{[\s\S]*?handleGooglePayActivityResult/
        )
    })

    it('keeps resources loaded by name or through generated registries', () => {
        expect(resourceKeep).toMatch(/tools:keep="[^"]*@raw\/mea_config/)
        expect(resourceKeep).toMatch(/tools:keep="[^"]*@drawable\/ic_stat_onesignal_default/)
        expect(resourceKeep).toMatch(/tools:keep="[^"]*@xml\/config/)
    })
})
