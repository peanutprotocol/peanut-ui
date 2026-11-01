#!/usr/bin/env node
/**
 * Uploads ./out as an OTA for this branch's builds for testing.
 *
 * A build for testing (scripts/build-branch.cjs: any branch but main) takes
 * OTAs only from its branch's own Capgo channel and only signed with the test
 * key, whose private half never leaves the machines that build test APKs. A
 * production install checks the production key, so nothing uploaded here can
 * run on one.
 *
 *   CAPGO_API_KEY=… PEANUT_NATIVE_VERSION=1.18.0-kyc6 node scripts/test-ota.mjs
 *
 * Build ./out first with the same env as the test APK (pnpm native:build).
 * PEANUT_TEST_OTA_KEY names the private key (default ~/.config/peanut/test-ota-key_v2).
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join } from 'node:path'

const require = createRequire(import.meta.url)
const { buildBranch, isTestBuild, testOtaChannel } = require('./build-branch.cjs')

const APP_ID = 'me.peanut.wallet'
const CAPGO_CLI = '@capgo/cli@8.42.4'

function fail(message) {
    console.error(`test-ota: ${message}`)
    process.exit(1)
}

const branch = buildBranch()
if (!isTestBuild(branch)) fail(`refusing "${branch || 'an unknown branch'}": only builds for testing use test channels`)
const apiKey = process.env.CAPGO_API_KEY || fail('set CAPGO_API_KEY to a Capgo API key that can upload')
const nativeVersion =
    process.env.PEANUT_NATIVE_VERSION || fail("set PEANUT_NATIVE_VERSION to the test APK's versionName")
const line =
    /^(\d+)\.(\d+)/.exec(nativeVersion) || fail(`PEANUT_NATIVE_VERSION ${nativeVersion} is not <major>.<build>…`)
const keyPath = process.env.PEANUT_TEST_OTA_KEY || join(homedir(), '.config/peanut/test-ota-key_v2')
if (!existsSync(keyPath)) fail(`no test signing key at ${keyPath}`)
if (!existsSync('out/index.html')) fail("build ./out first, with the test APK's env (pnpm native:build)")

// <major>.<build>.<YYMMDDHHmm>: the app compares major.build only, and Capgo needs it unique and above the binary
const stamp = new Date().toISOString().replace(/\D/g, '').slice(2, 12)
const version = `${line[1]}.${line[2]}.${stamp}`
const channel = testOtaChannel(branch)
const capgo = (...args) =>
    execFileSync('npx', ['--yes', CAPGO_CLI, ...args, '--apikey', apiKey], { stdio: ['ignore', 'inherit', 'inherit'] })

try {
    capgo('channel', 'add', channel, APP_ID)
} catch {
    // the channel exists from an earlier upload
}
// A binary names its channel itself (CapacitorUpdater.defaultChannel); Capgo lets it only into a self-assignable one.
capgo('channel', 'set', channel, APP_ID, '--self-assign')
capgo(
    'bundle',
    'upload',
    APP_ID,
    '--path',
    './out',
    '--channel',
    channel,
    '--bundle',
    version,
    '--key-data-v2',
    readFileSync(keyPath, 'utf8'),
    '--min-update-version',
    nativeVersion,
    '--comment',
    `test build: ${branch}`
)
console.log(`test-ota: ${version} is on ${channel}`)
