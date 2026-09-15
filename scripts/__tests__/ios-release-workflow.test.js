const fs = require('fs')
const path = require('path')

const workflowSource = fs.readFileSync(path.join(__dirname, '..', '..', '.github/workflows/ios-release.yml'), 'utf8')
const targetStripper = fs.readFileSync(path.join(__dirname, '..', 'disable-wallet-ios-targets.mjs'), 'utf8')

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
    })
})
