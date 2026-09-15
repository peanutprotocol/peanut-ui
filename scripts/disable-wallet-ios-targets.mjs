#!/usr/bin/env node

/**
 * Remove Wallet extension build dependencies from the app project for iOS
 * releases made before Apple's payment-pass-provisioning entitlement exists.
 * The source targets stay committed for local/entitled builds; this only
 * prevents an unentitled release archive from building or embedding them.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectPath = path.join(__dirname, '..', 'ios/App/App.xcodeproj/project.pbxproj')

export function disableWalletTargets(project) {
    const withoutEmbeddedExtensions = project.replace(
        /files = \(\n\s+AA000000000000000000000A \/\* PushProvisioningExtension\.appex in Embed App Extensions \*\/,[\s\S]*?\n\s+\);\n\s+name = "Embed App Extensions";/,
        'files = (\n\t\t\t);\n\t\t\tname = "Embed App Extensions";'
    )
    if (withoutEmbeddedExtensions === project) {
        throw new Error('[disable-wallet-ios-targets] Embed App Extensions phase anchor not found')
    }

    const withoutTargetDependencies = withoutEmbeddedExtensions.replace(
        /dependencies = \(\n\s+AA0000000000000000000701 \/\* PBXTargetDependency \*\/,\n\s+AA0000000000000000000702 \/\* PBXTargetDependency \*\/,[\s\S]*?\n\s+\);\n\s+name = App;/,
        'dependencies = (\n\t\t\t);\n\t\t\tname = App;'
    )
    if (withoutTargetDependencies === withoutEmbeddedExtensions) {
        throw new Error('[disable-wallet-ios-targets] App target dependency anchor not found')
    }
    return withoutTargetDependencies
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const project = fs.readFileSync(projectPath, 'utf8')
    fs.writeFileSync(projectPath, disableWalletTargets(project))
    console.log('[disable-wallet-ios-targets] Wallet extensions omitted from this unentitled archive')
}
