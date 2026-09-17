import { execFileSync } from 'node:child_process'

const tag = process.argv[2]
if (!/^v\d+\.\d+\.\d+$/.test(tag ?? '')) throw new Error('Expected a native release tag')
const contents = execFileSync('git', ['for-each-ref', '--format=%(objecttype)%0a%(contents)', `refs/tags/${tag}`], {
    encoding: 'utf8',
})
const attestation = 'peanut-native-capabilities-v1: android.pushProvisioning=compiled ios.pushProvisioning=compiled'
if (contents.split('\n')[0] !== 'tag' || !contents.split('\n').includes(attestation)) {
    throw new Error(
        `${tag} does not attest compiled provisioning on both platforms. Run App Release Android & iOS before publishing an OTA.`
    )
}
console.log(`${tag}: provisioning compiled on Android and iOS`)
