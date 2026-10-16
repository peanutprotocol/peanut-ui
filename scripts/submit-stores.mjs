#!/usr/bin/env node
// Submits a tagged store build that is already on the tester tracks:
//   ios      TestFlight build → App Store review, released automatically on approval
//   android  Play `internal` release → `production` track; a person still publishes it in the Play Console
//
// The release pipeline stops at the tester tracks so people can smoke test the
// exact binary first (ops/releases.md step 18). This replaces the console clicks
// that follow, except the Play publish. It never uploads a binary; it only moves
// the one that is there.
//
// Usage:
//   node scripts/submit-stores.mjs ios --version 1.14.0 [--dry-run] [--whats-new <text>]
//   node scripts/submit-stores.mjs android --version 1.14.0 [--dry-run] [--whats-new <text>] [--rollout 0.2]
//
// Env:
//   ios      ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_CONTENT (.p8 contents)
//   android  PLAY_SERVICE_ACCOUNT_JSON
//   ASC_API_BASE, PLAY_API_BASE, PLAY_TOKEN_URL point the calls at a fake server in tests.
//
// --dry-run reads everything and prints what it would change. It changes nothing in
// the stores (on Play it opens a draft edit and deletes it).

import { createPrivateKey, sign } from 'node:crypto'
import { realpathSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const BUNDLE_ID = 'me.peanut.wallet'
const PACKAGE_NAME = 'me.peanut.wallet'
const PLAIN_SEMVER = /^\d+\.\d+\.\d+$/

// Shown when nobody typed release notes: the fixed store text from
// ops/releases.md "Release notes". Keyed by language prefix of the App Store
// localization; anything else gets English. Add feature lines below the fixed
// text only for a big feature release, and remove them again after it ships.
const DEFAULT_WHATS_NEW = {
    en: 'Small fixes under the hood. Paying by QR, sending money and keeping a balance in dollars all work a little better in this version.',
    es: 'Pequeños ajustes por dentro. Guardar dólares, pagar con QR y enviar dinero funciona un poco mejor en esta versión.',
    pt: 'Pequenos ajustes nos bastidores. Guardar dólares, pagar com Pix e enviar dinheiro funcionam um pouco melhor nesta versão.',
}

// App Store versions that can still take a build and be submitted.
const EDITABLE_VERSION_STATES = new Set([
    'PREPARE_FOR_SUBMISSION',
    'READY_FOR_REVIEW',
    'DEVELOPER_REJECTED',
    'REJECTED',
    'METADATA_REJECTED',
    'INVALID_BINARY',
])

function parseArgs(argv) {
    const [platform, ...rest] = argv
    const flag = (name) => {
        const i = rest.indexOf(name)
        return i === -1 ? undefined : rest[i + 1]
    }
    const options = {
        platform,
        version: flag('--version'),
        dryRun: rest.includes('--dry-run'),
        whatsNew: (flag('--whats-new') ?? '').trim(),
        rollout: Number(flag('--rollout') ?? '1'),
    }
    if (platform !== 'ios' && platform !== 'android') throw new Error('first argument must be ios or android')
    if (!PLAIN_SEMVER.test(options.version ?? ''))
        throw new Error(`--version must be X.Y.Z, got "${options.version ?? ''}"`)
    if (!(options.rollout > 0 && options.rollout <= 1)) throw new Error('--rollout must be above 0 and at most 1')
    return options
}

function requireEnv(name) {
    const value = process.env[name]
    if (!value) throw new Error(`${name} is not set`)
    return value
}

function base64url(input) {
    return Buffer.from(input).toString('base64url')
}

function signJwt(header, payload, key, algorithm) {
    const data = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`
    // ES256 JWTs carry the raw r||s signature, not DER.
    const options = algorithm === 'ES256' ? { key, dsaEncoding: 'ieee-p1363' } : key
    return `${data}.${sign('sha256', Buffer.from(data), options).toString('base64url')}`
}

async function request(method, url, token, body) {
    const response = await fetch(url, {
        method,
        headers: {
            authorization: `Bearer ${token}`,
            ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await response.text()
    if (!response.ok) throw new Error(`${method} ${new URL(url).pathname} → ${response.status}: ${text.slice(0, 600)}`)
    return text ? JSON.parse(text) : {}
}

function log(line) {
    process.stdout.write(`${line}\n`)
}

// ---------- App Store Connect ----------

function ascToken() {
    const now = Math.floor(Date.now() / 1000)
    const key = createPrivateKey(requireEnv('ASC_KEY_CONTENT'))
    return signJwt(
        { alg: 'ES256', kid: requireEnv('ASC_KEY_ID'), typ: 'JWT' },
        { iss: requireEnv('ASC_ISSUER_ID'), iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' },
        key,
        'ES256'
    )
}

function versionState(version) {
    return version.attributes.appVersionState ?? version.attributes.appStoreState
}

async function submitIos({ version, dryRun, whatsNew }) {
    const base = process.env.ASC_API_BASE ?? 'https://api.appstoreconnect.apple.com'
    const token = ascToken()
    const asc = (method, path, body) => request(method, `${base}${path}`, token, body)

    const apps = await asc('GET', `/v1/apps?filter[bundleId]=${BUNDLE_ID}&limit=1`)
    const app = apps.data?.[0]
    if (!app) throw new Error(`no App Store Connect app for ${BUNDLE_ID}`)

    const builds = await asc(
        'GET',
        `/v1/builds?filter[app]=${app.id}&filter[preReleaseVersion.version]=${version}&sort=-uploadedDate&limit=1`
    )
    const build = builds.data?.[0]
    if (!build) throw new Error(`no TestFlight build for ${version}`)
    const processing = build.attributes.processingState
    if (processing !== 'VALID') {
        throw new Error(
            `TestFlight build ${version} (${build.attributes.version}) is ${processing}; retry once Apple finishes processing it`
        )
    }
    if (build.attributes.expired) throw new Error(`TestFlight build ${version} has expired`)
    log(`build: ${version} (${build.attributes.version}), processing VALID`)

    const versions = await asc('GET', `/v1/apps/${app.id}/appStoreVersions?filter[platform]=IOS&limit=50`)
    const exact = versions.data.find((v) => v.attributes.versionString === version)
    if (exact && !EDITABLE_VERSION_STATES.has(versionState(exact))) {
        throw new Error(`App Store version ${version} is already ${versionState(exact)}; nothing to submit`)
    }
    const editable = exact ?? versions.data.find((v) => EDITABLE_VERSION_STATES.has(versionState(v)))

    const openSubmissions = await asc(
        'GET',
        `/v1/reviewSubmissions?filter[app]=${app.id}&filter[platform]=IOS&filter[state]=READY_FOR_REVIEW,WAITING_FOR_REVIEW,IN_REVIEW,UNRESOLVED_ISSUES`
    )
    const inReview = openSubmissions.data.find((s) => s.attributes.state !== 'READY_FOR_REVIEW')
    if (inReview) {
        throw new Error(
            `a review submission is already ${inReview.attributes.state}; cancel it in App Store Connect first`
        )
    }
    const draftSubmission = openSubmissions.data[0]

    if (dryRun) {
        log(
            editable
                ? `would use App Store version ${editable.attributes.versionString} (${versionState(editable)})` +
                      (editable.attributes.versionString === version ? '' : `, renamed to ${version}`)
                : `would create App Store version ${version}`
        )
        log(`would attach build ${build.attributes.version}, set release on approval, fill empty What's New`)
        log(
            draftSubmission
                ? 'would reuse the draft review submission and submit it'
                : 'would create a review submission and submit it'
        )
        return
    }

    let appStoreVersion
    if (editable) {
        appStoreVersion = (
            await asc('PATCH', `/v1/appStoreVersions/${editable.id}`, {
                data: {
                    type: 'appStoreVersions',
                    id: editable.id,
                    attributes: { versionString: version, releaseType: 'AFTER_APPROVAL' },
                },
            })
        ).data
    } else {
        appStoreVersion = (
            await asc('POST', '/v1/appStoreVersions', {
                data: {
                    type: 'appStoreVersions',
                    attributes: { platform: 'IOS', versionString: version, releaseType: 'AFTER_APPROVAL' },
                    relationships: { app: { data: { type: 'apps', id: app.id } } },
                },
            })
        ).data
    }
    log(`App Store version ${version}: ${appStoreVersion.id}`)

    await asc('PATCH', `/v1/appStoreVersions/${appStoreVersion.id}/relationships/build`, {
        data: { type: 'builds', id: build.id },
    })
    log(`attached build ${build.attributes.version}`)

    const localizations = await asc('GET', `/v1/appStoreVersions/${appStoreVersion.id}/appStoreVersionLocalizations`)
    for (const localization of localizations.data) {
        // Keep notes someone already wrote in the console.
        if (localization.attributes.whatsNew?.trim()) continue
        const locale = localization.attributes.locale
        const text = whatsNew || DEFAULT_WHATS_NEW[locale.slice(0, 2)] || DEFAULT_WHATS_NEW.en
        await asc('PATCH', `/v1/appStoreVersionLocalizations/${localization.id}`, {
            data: { type: 'appStoreVersionLocalizations', id: localization.id, attributes: { whatsNew: text } },
        })
        log(`What's New (${locale}): ${text}`)
    }

    const submissionId =
        draftSubmission?.id ??
        (
            await asc('POST', '/v1/reviewSubmissions', {
                data: {
                    type: 'reviewSubmissions',
                    attributes: { platform: 'IOS' },
                    relationships: { app: { data: { type: 'apps', id: app.id } } },
                },
            })
        ).data.id
    const items = await asc('GET', `/v1/reviewSubmissions/${submissionId}/items?include=appStoreVersion`)
    const hasVersion = items.data.some((item) => item.relationships?.appStoreVersion?.data?.id === appStoreVersion.id)
    if (!hasVersion) {
        await asc('POST', '/v1/reviewSubmissionItems', {
            data: {
                type: 'reviewSubmissionItems',
                relationships: {
                    reviewSubmission: { data: { type: 'reviewSubmissions', id: submissionId } },
                    appStoreVersion: { data: { type: 'appStoreVersions', id: appStoreVersion.id } },
                },
            },
        })
    }
    await asc('PATCH', `/v1/reviewSubmissions/${submissionId}`, {
        data: { type: 'reviewSubmissions', id: submissionId, attributes: { submitted: true } },
    })
    log(`submitted ${version} for App Store review; releases automatically on approval`)
}

// ---------- Google Play ----------

async function playToken() {
    const account = JSON.parse(requireEnv('PLAY_SERVICE_ACCOUNT_JSON'))
    const tokenUrl = process.env.PLAY_TOKEN_URL ?? account.token_uri ?? 'https://oauth2.googleapis.com/token'
    const now = Math.floor(Date.now() / 1000)
    const assertion = signJwt(
        { alg: 'RS256', typ: 'JWT' },
        {
            iss: account.client_email,
            scope: 'https://www.googleapis.com/auth/androidpublisher',
            aud: account.token_uri ?? tokenUrl,
            iat: now,
            exp: now + 3600,
        },
        createPrivateKey(account.private_key),
        'RS256'
    )
    const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    })
    const text = await response.text()
    if (!response.ok) throw new Error(`Google token → ${response.status}: ${text.slice(0, 300)}`)
    return JSON.parse(text).access_token
}

// Play names an API-uploaded release after the bundle: "<versionCode> (<versionName>)".
function releaseMatchesVersion(release, version) {
    const name = release.name ?? ''
    return name === version || name.endsWith(`(${version})`)
}

async function submitAndroid({ version, dryRun, whatsNew, rollout }) {
    const base = process.env.PLAY_API_BASE ?? 'https://androidpublisher.googleapis.com'
    const token = await playToken()
    const app = `${base}/androidpublisher/v3/applications/${PACKAGE_NAME}`
    const play = (method, path, body) => request(method, `${app}${path}`, token, body)

    const edit = await play('POST', '/edits', {})
    try {
        const internal = await play('GET', `/edits/${edit.id}/tracks/internal`)
        const matches = (internal.releases ?? []).filter((r) => releaseMatchesVersion(r, version))
        if (matches.length !== 1) {
            const names = (internal.releases ?? []).map((r) => r.name).join(', ') || 'none'
            throw new Error(
                `expected one internal release named for ${version}, found ${matches.length} (internal: ${names})`
            )
        }
        const versionCodes = matches[0].versionCodes
        const production = await play('GET', `/edits/${edit.id}/tracks/production`)
        const live = (production.releases ?? []).filter((r) => r.status === 'completed' || r.status === 'inProgress')
        const newestLive = Math.max(0, ...live.flatMap((r) => r.versionCodes ?? []).map(Number))
        if (versionCodes.some((code) => Number(code) <= newestLive)) {
            throw new Error(
                `versionCode ${versionCodes.join(',')} is not above production ${newestLive}; ${version} is already live or older`
            )
        }
        const status = rollout < 1 ? 'inProgress' : 'completed'
        const release = {
            name: version,
            versionCodes,
            status,
            ...(rollout < 1 ? { userFraction: rollout } : {}),
            releaseNotes: [{ language: 'en-US', text: whatsNew || DEFAULT_WHATS_NEW.en }],
        }
        log(`internal ${version}: versionCode ${versionCodes.join(',')}; production now ${newestLive || 'empty'}`)
        if (dryRun) {
            log(
                `would move ${version} to the Play production track, ${status}${rollout < 1 ? ` at ${rollout * 100}%` : ''}; it then needs a manual publish in the Play Console`
            )
            await play('DELETE', `/edits/${edit.id}`)
            return
        }
        await play('PUT', `/edits/${edit.id}/tracks/production`, { track: 'production', releases: [release] })
        await play('POST', `/edits/${edit.id}:commit`)
        log(
            `moved ${version} to the Play production track (${status}${rollout < 1 ? `, ${rollout * 100}%` : ''}). Not published yet: publish it by hand in the Play Console; Google reviews it after that`
        )
    } catch (error) {
        // An uncommitted edit blocks nothing, but leaving one is untidy; a failed
        // delete must not hide the real error.
        await play('DELETE', `/edits/${edit.id}`).catch(() => {})
        throw error
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
    try {
        const options = parseArgs(process.argv.slice(2))
        await (options.platform === 'ios' ? submitIos(options) : submitAndroid(options))
    } catch (error) {
        process.stderr.write(`::error::${error.message}\n`)
        process.exit(1)
    }
}
