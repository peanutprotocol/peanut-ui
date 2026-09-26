#!/usr/bin/env node

import fs from 'node:fs'

function required(name) {
    const value = process.env[name]
    if (!value) throw new Error(`[render-ios-export-options] ${name} is required`)
    return value
}

function escapeXml(value) {
    return value.replace(
        /[&<>"']/g,
        (character) =>
            ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&apos;',
            })[character]
    )
}

export function renderExportOptionsPlist({
    appProfileName,
    teamId,
    walletEnabled,
    walletExtensionProfileName,
    walletExtensionUiProfileName,
}) {
    if (walletEnabled && (!walletExtensionProfileName || !walletExtensionUiProfileName)) {
        throw new Error('[render-ios-export-options] Wallet profile names are required when Wallet is enabled')
    }

    const walletProfiles = walletEnabled
        ? `
        <key>me.peanut.wallet.PushProvisioningExtension</key>
        <string>${escapeXml(walletExtensionProfileName)}</string>
        <key>me.peanut.wallet.PushProvisioningExtensionUI</key>
        <string>${escapeXml(walletExtensionUiProfileName)}</string>`
        : ''

    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store</string>
    <key>teamID</key>
    <string>${escapeXml(teamId)}</string>
    <key>signingStyle</key>
    <string>manual</string>
    <key>provisioningProfiles</key>
    <dict>
        <key>me.peanut.wallet</key>
        <string>${escapeXml(appProfileName)}</string>${walletProfiles}
    </dict>
    <key>uploadSymbols</key>
    <true/>
</dict>
</plist>
`
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
    const outputPath = process.env.EXPORT_OPTIONS_PATH || '/tmp/ExportOptions.plist'
    const plist = renderExportOptionsPlist({
        appProfileName: required('PROFILE_NAME'),
        teamId: required('APPLE_TEAM_ID'),
        walletEnabled: process.env.WALLET_PROVISIONING_ENABLED === 'true',
        walletExtensionProfileName: process.env.WALLET_EXTENSION_PROFILE_NAME,
        walletExtensionUiProfileName: process.env.WALLET_EXTENSION_UI_PROFILE_NAME,
    })
    fs.writeFileSync(outputPath, plist)
    console.log(`[render-ios-export-options] wrote ${outputPath}`)
}
