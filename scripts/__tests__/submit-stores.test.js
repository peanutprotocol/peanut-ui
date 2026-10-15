/** @jest-environment node */
const http = require('node:http')
const path = require('node:path')
const { generateKeyPairSync, verify } = require('node:crypto')
const { spawn } = require('node:child_process')

const SCRIPT = path.join(__dirname, '..', 'submit-stores.mjs')

const ec = generateKeyPairSync('ec', { namedCurve: 'P-256' })
const rsa = generateKeyPairSync('rsa', { modulusLength: 2048 })

// A fake App Store Connect + Google Play: `routes` answers each "METHOD /path",
// and every call is recorded so a test can assert what the script changed.
function startServer(routes) {
    const calls = []
    const server = http.createServer((req, res) => {
        let body = ''
        req.on('data', (chunk) => (body += chunk))
        req.on('end', () => {
            const url = new URL(req.url, 'http://x')
            const key = `${req.method} ${url.pathname}`
            calls.push({ key, search: url.search, headers: req.headers, body: body ? tryJson(body) : undefined })
            const route = routes[key]
            const [status, payload] = typeof route === 'function' ? route(url, body) : (route ?? [404, { error: key }])
            res.writeHead(status, { 'content-type': 'application/json' })
            res.end(payload === undefined ? '' : JSON.stringify(payload))
        })
    })
    return new Promise((resolve) =>
        server.listen(0, '127.0.0.1', () =>
            resolve({ server, calls, base: `http://127.0.0.1:${server.address().port}` })
        )
    )
}

function tryJson(text) {
    try {
        return JSON.parse(text)
    } catch {
        return text
    }
}

function run(args, env) {
    return new Promise((resolve) => {
        const child = spawn(process.execPath, [SCRIPT, ...args], { env: { PATH: process.env.PATH, ...env } })
        let stdout = ''
        let stderr = ''
        child.stdout.on('data', (d) => (stdout += d))
        child.stderr.on('data', (d) => (stderr += d))
        child.on('close', (status) => resolve({ status, stdout, stderr }))
    })
}

function writes(calls) {
    return calls.filter((c) => c.key.split(' ')[0] !== 'GET').map((c) => c.key)
}

// ---------- iOS ----------

function iosEnv(base) {
    return {
        ASC_API_BASE: base,
        ASC_KEY_ID: 'KEY123',
        ASC_ISSUER_ID: 'issuer-1',
        ASC_KEY_CONTENT: ec.privateKey.export({ type: 'pkcs8', format: 'pem' }),
    }
}

function iosRoutes({ processingState = 'VALID', versions = [], submissions = [], localizations } = {}) {
    return {
        'GET /v1/apps': [200, { data: [{ id: 'app-1' }] }],
        'GET /v1/builds': [
            200,
            { data: [{ id: 'build-9', attributes: { version: '42', processingState, expired: false } }] },
        ],
        'GET /v1/apps/app-1/appStoreVersions': [200, { data: versions }],
        'GET /v1/reviewSubmissions': [200, { data: submissions }],
        'POST /v1/appStoreVersions': [201, { data: { id: 'ver-new' } }],
        'PATCH /v1/appStoreVersions/ver-old': [200, { data: { id: 'ver-old' } }],
        'PATCH /v1/appStoreVersions/ver-new/relationships/build': [204],
        'PATCH /v1/appStoreVersions/ver-old/relationships/build': [204],
        'GET /v1/appStoreVersions/ver-new/appStoreVersionLocalizations': [
            200,
            {
                data: localizations ?? [
                    { id: 'loc-en', attributes: { locale: 'en-US', whatsNew: null } },
                    { id: 'loc-pt', attributes: { locale: 'pt-BR', whatsNew: '' } },
                    { id: 'loc-es', attributes: { locale: 'es-MX', whatsNew: 'Ya escrito' } },
                ],
            },
        ],
        'GET /v1/appStoreVersions/ver-old/appStoreVersionLocalizations': [200, { data: [] }],
        'PATCH /v1/appStoreVersionLocalizations/loc-en': [200, { data: {} }],
        'PATCH /v1/appStoreVersionLocalizations/loc-pt': [200, { data: {} }],
        'POST /v1/reviewSubmissions': [201, { data: { id: 'sub-1' } }],
        'GET /v1/reviewSubmissions/sub-1/items': [200, { data: [] }],
        'GET /v1/reviewSubmissions/sub-draft/items': [200, { data: [] }],
        'POST /v1/reviewSubmissionItems': [201, { data: { id: 'item-1' } }],
        'PATCH /v1/reviewSubmissions/sub-1': [200, { data: {} }],
        'PATCH /v1/reviewSubmissions/sub-draft': [200, { data: {} }],
    }
}

describe('submit-stores ios', () => {
    let fake
    afterEach(() => fake?.server.close())

    it('creates the version, attaches the build, fills empty notes and submits', async () => {
        fake = await startServer(iosRoutes())
        const result = await run(['ios', '--version', '1.14.0'], iosEnv(fake.base))
        expect(result.stderr).toBe('')
        expect(result.status).toBe(0)
        expect(writes(fake.calls)).toEqual([
            'POST /v1/appStoreVersions',
            'PATCH /v1/appStoreVersions/ver-new/relationships/build',
            'PATCH /v1/appStoreVersionLocalizations/loc-en',
            'PATCH /v1/appStoreVersionLocalizations/loc-pt',
            'POST /v1/reviewSubmissions',
            'POST /v1/reviewSubmissionItems',
            'PATCH /v1/reviewSubmissions/sub-1',
        ])
        const created = fake.calls.find((c) => c.key === 'POST /v1/appStoreVersions').body.data.attributes
        expect(created).toEqual({ platform: 'IOS', versionString: '1.14.0', releaseType: 'AFTER_APPROVAL' })
        const pt = fake.calls.find((c) => c.key === 'PATCH /v1/appStoreVersionLocalizations/loc-pt').body
        expect(pt.data.attributes.whatsNew).toBe(
            'Pequenos ajustes nos bastidores. Guardar dólares, pagar com Pix e enviar dinheiro funcionam um pouco melhor nesta versão.'
        )
        const submit = fake.calls.find((c) => c.key === 'PATCH /v1/reviewSubmissions/sub-1').body
        expect(submit.data.attributes).toEqual({ submitted: true })
    })

    it('signs a valid ES256 token for App Store Connect', async () => {
        fake = await startServer(iosRoutes())
        await run(['ios', '--version', '1.14.0', '--dry-run'], iosEnv(fake.base))
        const [header, payload, signature] = fake.calls[0].headers.authorization.replace('Bearer ', '').split('.')
        expect(JSON.parse(Buffer.from(header, 'base64url'))).toEqual({ alg: 'ES256', kid: 'KEY123', typ: 'JWT' })
        expect(JSON.parse(Buffer.from(payload, 'base64url'))).toMatchObject({
            iss: 'issuer-1',
            aud: 'appstoreconnect-v1',
        })
        const ok = verify(
            'sha256',
            Buffer.from(`${header}.${payload}`),
            { key: ec.publicKey, dsaEncoding: 'ieee-p1363' },
            Buffer.from(signature, 'base64url')
        )
        expect(ok).toBe(true)
    })

    it('reuses an editable version under its new number', async () => {
        fake = await startServer(
            iosRoutes({
                versions: [
                    {
                        id: 'ver-old',
                        attributes: { versionString: '1.11.0', appVersionState: 'PREPARE_FOR_SUBMISSION' },
                    },
                ],
            })
        )
        const result = await run(['ios', '--version', '1.14.0'], iosEnv(fake.base))
        expect(result.status).toBe(0)
        const patch = fake.calls.find((c) => c.key === 'PATCH /v1/appStoreVersions/ver-old').body
        expect(patch.data.attributes).toEqual({ versionString: '1.14.0', releaseType: 'AFTER_APPROVAL' })
        expect(writes(fake.calls)).not.toContain('POST /v1/appStoreVersions')
    })

    it('dry run writes nothing', async () => {
        fake = await startServer(iosRoutes())
        const result = await run(['ios', '--version', '1.14.0', '--dry-run'], iosEnv(fake.base))
        expect(result.status).toBe(0)
        expect(result.stdout).toContain('would create App Store version 1.14.0')
        expect(writes(fake.calls)).toEqual([])
    })

    it('stops while Apple is still processing the build', async () => {
        fake = await startServer(iosRoutes({ processingState: 'PROCESSING' }))
        const result = await run(['ios', '--version', '1.14.0'], iosEnv(fake.base))
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('is PROCESSING')
        expect(writes(fake.calls)).toEqual([])
    })

    it('stops when the version is already in review', async () => {
        fake = await startServer(
            iosRoutes({
                versions: [
                    { id: 'ver-x', attributes: { versionString: '1.14.0', appVersionState: 'WAITING_FOR_REVIEW' } },
                ],
            })
        )
        const result = await run(['ios', '--version', '1.14.0'], iosEnv(fake.base))
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('already WAITING_FOR_REVIEW')
        expect(writes(fake.calls)).toEqual([])
    })

    it('stops when another submission is waiting for review', async () => {
        fake = await startServer(
            iosRoutes({ submissions: [{ id: 'sub-w', attributes: { state: 'WAITING_FOR_REVIEW' } }] })
        )
        const result = await run(['ios', '--version', '1.14.0'], iosEnv(fake.base))
        expect(result.status).toBe(1)
        expect(writes(fake.calls)).toEqual([])
    })

    it('rejects a version that is not X.Y.Z', async () => {
        const result = await run(['ios', '--version', '1.14'], {})
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('--version must be X.Y.Z')
    })
})

// ---------- Android ----------

const PLAY = '/androidpublisher/v3/applications/me.peanut.wallet'

function androidEnv(base) {
    return {
        PLAY_API_BASE: base,
        PLAY_TOKEN_URL: `${base}/token`,
        PLAY_SERVICE_ACCOUNT_JSON: JSON.stringify({
            client_email: 'ci@peanut.iam.gserviceaccount.com',
            private_key: rsa.privateKey.export({ type: 'pkcs8', format: 'pem' }),
            token_uri: 'https://oauth2.googleapis.com/token',
        }),
    }
}

function androidRoutes({ internal, production = [] } = {}) {
    return {
        'POST /token': [200, { access_token: 'play-token' }],
        [`POST ${PLAY}/edits`]: [200, { id: 'edit-1' }],
        [`GET ${PLAY}/edits/edit-1/tracks/internal`]: [
            200,
            {
                releases: internal ?? [
                    { name: '45 (1.14.0)', versionCodes: ['45'], status: 'completed' },
                    { name: '44 (1.13.0)', versionCodes: ['44'], status: 'completed' },
                ],
            },
        ],
        [`GET ${PLAY}/edits/edit-1/tracks/production`]: [200, { releases: production }],
        [`PUT ${PLAY}/edits/edit-1/tracks/production`]: [200, {}],
        [`POST ${PLAY}/edits/edit-1:commit`]: [200, {}],
        [`DELETE ${PLAY}/edits/edit-1`]: [204],
    }
}

const liveProduction = [{ name: '30 (1.11.0)', versionCodes: ['30'], status: 'completed' }]

describe('submit-stores android', () => {
    let fake
    afterEach(() => fake?.server.close())

    it('promotes the internal release for the version to production', async () => {
        fake = await startServer(androidRoutes({ production: liveProduction }))
        const result = await run(['android', '--version', '1.14.0'], androidEnv(fake.base))
        expect(result.stderr).toBe('')
        expect(result.status).toBe(0)
        expect(result.stdout).toContain('Not published yet: publish it by hand in the Play Console')
        expect(writes(fake.calls)).toEqual([
            'POST /token',
            `POST ${PLAY}/edits`,
            `PUT ${PLAY}/edits/edit-1/tracks/production`,
            `POST ${PLAY}/edits/edit-1:commit`,
        ])
        const put = fake.calls.find((c) => c.key === `PUT ${PLAY}/edits/edit-1/tracks/production`).body
        expect(put).toEqual({
            track: 'production',
            releases: [
                {
                    name: '1.14.0',
                    versionCodes: ['45'],
                    status: 'completed',
                    releaseNotes: [
                        {
                            language: 'en-US',
                            text: 'Small fixes under the hood. Paying by QR, sending money and keeping a balance in dollars all work a little better in this version.',
                        },
                    ],
                },
            ],
        })
        const assertion = new URLSearchParams(fake.calls[0].body).get('assertion')
        const [, payload] = assertion.split('.')
        expect(JSON.parse(Buffer.from(payload, 'base64url'))).toMatchObject({
            iss: 'ci@peanut.iam.gserviceaccount.com',
            scope: 'https://www.googleapis.com/auth/androidpublisher',
            aud: 'https://oauth2.googleapis.com/token',
        })
    })

    it('stages the rollout when asked', async () => {
        fake = await startServer(androidRoutes({ production: liveProduction }))
        const result = await run(['android', '--version', '1.14.0', '--rollout', '0.2'], androidEnv(fake.base))
        expect(result.status).toBe(0)
        const put = fake.calls.find((c) => c.key === `PUT ${PLAY}/edits/edit-1/tracks/production`).body
        expect(put.releases[0]).toMatchObject({ status: 'inProgress', userFraction: 0.2 })
    })

    it('dry run commits nothing and deletes its edit', async () => {
        fake = await startServer(androidRoutes({ production: liveProduction }))
        const result = await run(['android', '--version', '1.14.0', '--dry-run'], androidEnv(fake.base))
        expect(result.status).toBe(0)
        expect(result.stdout).toContain('would move 1.14.0 to the Play production track')
        expect(writes(fake.calls)).toEqual(['POST /token', `POST ${PLAY}/edits`, `DELETE ${PLAY}/edits/edit-1`])
    })

    it('stops when no internal release carries the version', async () => {
        fake = await startServer(androidRoutes({ internal: [{ name: '44 (1.13.0)', versionCodes: ['44'] }] }))
        const result = await run(['android', '--version', '1.14.0'], androidEnv(fake.base))
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('found 0')
        expect(writes(fake.calls)).not.toContain(`PUT ${PLAY}/edits/edit-1/tracks/production`)
        expect(writes(fake.calls)).toContain(`DELETE ${PLAY}/edits/edit-1`)
    })

    it('stops when production already has this build or a newer one', async () => {
        fake = await startServer(
            androidRoutes({ production: [{ name: '45 (1.14.0)', versionCodes: ['45'], status: 'completed' }] })
        )
        const result = await run(['android', '--version', '1.14.0'], androidEnv(fake.base))
        expect(result.status).toBe(1)
        expect(result.stderr).toContain('not above production 45')
        expect(writes(fake.calls)).not.toContain(`POST ${PLAY}/edits/edit-1:commit`)
    })
})
