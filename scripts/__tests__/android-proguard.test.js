const fs = require('fs')
const path = require('path')

const rules = fs.readFileSync(path.join(__dirname, '..', '..', 'android', 'app', 'proguard-rules.pro'), 'utf8')

describe('Android release shrinker rules', () => {
    it('preserves the Capacitor permission annotations read at runtime', () => {
        expect(rules).toMatch(/-keepattributes\s+RuntimeVisibleAnnotations,AnnotationDefault/)
        expect(rules).toMatch(/-keep\s+@interface\s+com\.getcapacitor\.annotation\.CapacitorPlugin\s+\{\s*\*;\s*\}/)
        expect(rules).toMatch(/-keep\s+@interface\s+com\.getcapacitor\.annotation\.Permission\s+\{\s*\*;\s*\}/)
    })
})
