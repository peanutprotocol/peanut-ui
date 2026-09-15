const fs = require('fs')
const path = require('path')

const workflowSource = fs.readFileSync(path.join(__dirname, '..', '..', '.github/workflows/ios-release.yml'), 'utf8')

describe('iOS release workflow', () => {
    it('accepts plutil raw true for the Wallet extension entitlement', () => {
        expect(workflowSource).toContain('if [ "$PAYMENT" != "true" ]; then')
        expect(workflowSource).not.toContain('if [ "$PAYMENT" != "1" ]; then')
    })
})
