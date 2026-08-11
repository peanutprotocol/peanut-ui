/** @jest-environment node */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'

const WORKFLOW_PATH = resolve(process.cwd(), '.github/workflows/preview.yaml')
const PRODUCTION_MARKER_DIGEST = '4307ae3e7601ca23faf31181ac9f268fd5c7c6c510d6ab56a49c1abb1a171dc4'
const OWNERSHIP_COMMENT = 'split-b3a-canary; owner=peanutprotocol/peanut-ui#2670; controller=ephemeral-workflow-v1'
const TEST_MARKER = 'a'.repeat(64)
const TEST_TOKEN = 'vercel-test-token-that-must-never-be-logged'
const TEST_ORIGIN = 'https://peanutsplit.com'
const TEST_RESPONSE_SECRET = 'response-and-header-secret-that-must-never-be-logged'
const TEST_SHA = '1'.repeat(40)

type EnvRow = {
    id?: string
    key: string
    value: string
    type: string
    target: string | string[]
    comment?: string
    gitBranch?: string | null
    customEnvironmentIds?: string[]
    configurationId?: string | null
    edgeConfigId?: string | null
    edgeConfigTokenId?: string | null
    contentHint?: unknown
    internalContentHint?: unknown
    sunsetSecretId?: string | null
    system?: boolean
    visibility?: string
}

type ApiCall = {
    method: string
    path: string
    search: string
    body?: unknown
    headers: Record<string, string>
}

type HarnessOptions = {
    initialRows?: EnvRow[]
    expectedWorkflowSha?: string
    envOverrides?: Record<string, string>
    inventoryVariant?: 'hidden' | 'pagination'
    inventoryResponse?: unknown
    hiddenProductionEnvCount?: unknown
    pagination?: unknown
    postResponse?: unknown
    postRows?: EnvRow[]
    deleteResponse?: unknown
    apiFailure?: {
        method: string
        path: string
        status: number
    }
    projectOverrides?: Record<string, unknown>
    projectLinkOverrides?: Partial<{
        type: string
        org: string
        repo: string
        productionBranch: string
    }>
    teamOverrides?: Record<string, unknown>
}

const workflow = readFileSync(WORKFLOW_PATH, 'utf8')

function extractManagementScript(): string {
    const match = workflow.match(/node <<'NODE'\n([\s\S]*?)\n\s+NODE(?:\n|$)/)
    if (!match) throw new Error('Missing inline Split Production environment script')

    const nonEmptyLines = match[1].split('\n').filter((line) => line.trim().length > 0)
    const minimumIndent = Math.min(...nonEmptyLines.map((line) => line.match(/^ */)?.[0].length ?? 0))
    return match[1]
        .split('\n')
        .map((line) => line.slice(Math.min(minimumIndent, line.length)))
        .join('\n')
}

function desiredRows(): EnvRow[] {
    return [
        {
            id: 'env_origin',
            key: 'SPLIT_CONTENT_ORIGIN',
            value: TEST_ORIGIN,
            type: 'plain',
            target: ['production'],
            comment: OWNERSHIP_COMMENT,
            gitBranch: null,
            customEnvironmentIds: [],
        },
        {
            id: 'env_marker',
            key: 'SPLIT_CONTENT_EDGE_MARKER',
            value: TEST_MARKER,
            type: 'sensitive',
            target: ['production'],
            comment: OWNERSHIP_COMMENT,
            gitBranch: null,
            customEnvironmentIds: [],
        },
    ]
}

function hasOwn(value: object, key: string): boolean {
    return Object.prototype.hasOwnProperty.call(value, key)
}

async function runHarness(operation: string, options: HarnessOptions = {}) {
    let rows = structuredClone(options.initialRows ?? [])
    const calls: ApiCall[] = []
    const logs: string[] = []
    const errors: string[] = []
    const summaries: string[] = []

    const response = (payload: unknown, status = 200, rawBody = '') => ({
        ok: status >= 200 && status < 300,
        status,
        headers: new Headers({ 'x-test-secret': TEST_RESPONSE_SECRET }),
        json: async () => structuredClone(payload),
        arrayBuffer: async () => new TextEncoder().encode(rawBody).buffer,
    })

    const fetchMock = jest.fn(async (input: string, init: RequestInit = {}) => {
        const url = new URL(input)
        const method = (init.method ?? 'GET').toUpperCase()
        const body = init.body ? JSON.parse(String(init.body)) : undefined
        const headers = Object.fromEntries(new Headers(init.headers).entries())
        calls.push({ method, path: url.pathname, search: url.search, body, headers })

        if (options.apiFailure && options.apiFailure.method === method && options.apiFailure.path === url.pathname) {
            return response(
                { error: { message: TEST_RESPONSE_SECRET, token: TEST_TOKEN } },
                options.apiFailure.status,
                `${TEST_RESPONSE_SECRET}:${TEST_MARKER}:${TEST_TOKEN}:${TEST_ORIGIN}`
            )
        }

        if (method === 'GET' && url.pathname === '/v9/projects/peanut-wallet') {
            return response({
                id: 'prj_peanut_wallet',
                name: 'peanut-wallet',
                accountId: 'team_squirrellabs',
                link: {
                    type: 'github',
                    org: 'peanutprotocol',
                    repo: 'peanut-ui',
                    productionBranch: 'main',
                    ...options.projectLinkOverrides,
                },
                ...options.projectOverrides,
            })
        }
        if (method === 'GET' && url.pathname === '/v2/teams/team_squirrellabs') {
            return response({
                id: 'team_squirrellabs',
                slug: 'squirrellabs',
                ...options.teamOverrides,
            })
        }
        if (method === 'GET' && url.pathname === '/v10/projects/prj_peanut_wallet/env') {
            if (hasOwn(options, 'inventoryResponse')) {
                return response(options.inventoryResponse)
            }
            if (options.inventoryVariant === 'pagination') {
                return response({
                    envs: structuredClone(rows),
                    pagination: hasOwn(options, 'pagination')
                        ? options.pagination
                        : { count: rows.length, next: null, prev: null },
                })
            }
            return response({
                envs: structuredClone(rows),
                hiddenProductionEnvCount: hasOwn(options, 'hiddenProductionEnvCount')
                    ? options.hiddenProductionEnvCount
                    : 0,
            })
        }
        if (method === 'POST' && url.pathname === '/v10/projects/prj_peanut_wallet/env') {
            const records = body as EnvRow[]
            const created = records.map((record, index) => ({
                ...record,
                id: index === 0 ? 'env_origin' : 'env_marker',
            }))
            rows = structuredClone(hasOwn(options, 'postRows') ? (options.postRows ?? []) : created)
            return response(
                hasOwn(options, 'postResponse')
                    ? options.postResponse
                    : { created: structuredClone(created), failed: [] },
                201
            )
        }
        if (method === 'DELETE' && url.pathname === '/v1/projects/prj_peanut_wallet/env') {
            const ids = (body as { ids: string[] }).ids
            rows = rows.filter((row) => !row.id || !ids.includes(row.id))
            return response(
                hasOwn(options, 'deleteResponse')
                    ? options.deleteResponse
                    : { deleted: ids.length, ids: structuredClone(ids) }
            )
        }

        throw new Error(`Unexpected fake Vercel call: ${method} ${url.pathname}`)
    })

    const testDigest = createHash('sha256').update(TEST_MARKER, 'utf8').digest('hex')
    const executable = extractManagementScript()
        .replace(PRODUCTION_MARKER_DIGEST, testDigest)
        .replace(';(async () => {', 'globalThis.__workflowPromise = (async () => {')
    const fakeProcess = {
        env: {
            OPERATION: operation,
            EXPECTED_WORKFLOW_SHA: options.expectedWorkflowSha ?? TEST_SHA,
            TRIGGERING_ACTOR_ID: '10008415',
            SPLIT_CONTENT_ORIGIN: TEST_ORIGIN,
            SPLIT_CONTENT_EDGE_MARKER: TEST_MARKER,
            VERCEL_TOKEN: TEST_TOKEN,
            GITHUB_ACTIONS: 'true',
            GITHUB_EVENT_NAME: 'workflow_dispatch',
            GITHUB_REPOSITORY: 'peanutprotocol/peanut-ui',
            GITHUB_REPOSITORY_ID: '667545617',
            GITHUB_REF: 'refs/heads/ops/split-b3a-vercel-production-env',
            GITHUB_SHA: TEST_SHA,
            GITHUB_WORKFLOW_REF:
                'peanutprotocol/peanut-ui/.github/workflows/preview.yaml@refs/heads/ops/split-b3a-vercel-production-env',
            GITHUB_WORKFLOW_SHA: TEST_SHA,
            GITHUB_ACTOR: '0xkkonrad',
            GITHUB_ACTOR_ID: '10008415',
            GITHUB_RUN_ATTEMPT: '1',
            GITHUB_TRIGGERING_ACTOR: '0xkkonrad',
            GITHUB_STEP_SUMMARY: '/tmp/unused-split-b3a-summary',
            ...options.envOverrides,
        },
        exitCode: 0,
    }
    const sandboxRequire = (specifier: string) => {
        if (specifier === 'node:fs') {
            return {
                appendFileSync: (_path: string, content: string) => summaries.push(String(content)),
            }
        }
        return require(specifier)
    }
    const sandbox: Record<string, unknown> = {
        require: sandboxRequire,
        process: fakeProcess,
        fetch: fetchMock,
        AbortSignal,
        Buffer,
        URL,
        URLSearchParams,
        structuredClone,
        console: {
            log: (...parts: unknown[]) => logs.push(parts.join(' ')),
            error: (...parts: unknown[]) => errors.push(parts.join(' ')),
        },
    }
    sandbox.globalThis = sandbox

    runInNewContext(executable, sandbox, { timeout: 1_000 })
    await (sandbox.__workflowPromise as Promise<void>)

    return { calls, errors, exitCode: fakeProcess.exitCode, logs, rows, summaries }
}

type HarnessResult = Awaited<ReturnType<typeof runHarness>>

function expectNoSecretOutput(result: HarnessResult) {
    const output = [...result.logs, ...result.errors, ...result.summaries].join('\n')
    expect(output).not.toContain(TEST_MARKER)
    expect(output).not.toContain(TEST_TOKEN)
    expect(output).not.toContain(TEST_ORIGIN)
    expect(output).not.toContain(TEST_RESPONSE_SECRET)
    expect(output).not.toContain('Bearer ')
}

function expectNoMutations(result: HarnessResult) {
    expect(result.calls.every((call) => call.method === 'GET')).toBe(true)
}

describe('temporary Split Production environment workflow contract', () => {
    it('preserves Preview behavior and pins the non-cancelling Production operation lane', () => {
        expect(workflow).toContain('default: preview')
        expect(workflow).toContain("if: github.event_name == 'pull_request' || inputs.operation == 'preview'")
        expect(workflow).toContain('run: vercel build --target=preview --token=${{ secrets.VERCEL_TOKEN }}')
        expect(workflow).toContain(
            'run: vercel deploy --prebuilt --archive=tgz --target=preview --scope=squirrellabs --token=${{ secrets.VERCEL_TOKEN }}'
        )
        expect(workflow).toContain("'split-b3a-production-env-operations'")
        expect(workflow).toContain(
            "cancel-in-progress: ${{ github.event_name != 'workflow_dispatch' || inputs.operation == 'preview' }}"
        )
        expect(workflow).toContain('TRIGGERING_ACTOR_ID: ${{ github.actor_id }}')
        expect(workflow).toContain("process.env.GITHUB_RUN_ATTEMPT === '1'")
        expect(workflow).toContain('process.env.GITHUB_TRIGGERING_ACTOR === DISPATCH_ACTOR')
        expect(workflow).toContain('refs/heads/ops/split-b3a-vercel-production-env')
        expect(workflow).toContain("const REPOSITORY_ID = '667545617'")
        expect(workflow).toContain('process.env.GITHUB_WORKFLOW_REF === WORKFLOW_IDENTITY')
        expect(workflow).toContain("const DISPATCH_ACTOR = '0xkkonrad'")
        expect(workflow).toContain("const DISPATCH_ACTOR_ID = '10008415'")
        expect(workflow).toContain(PRODUCTION_MARKER_DIGEST)
        expect(workflow).toContain(OWNERSHIP_COMMENT)
        expect(workflow).toContain('team.id === project.accountId && team.slug === TEAM_SLUG')
        expect(workflow).toContain('project.link.org === GIT_ORG')
        expect(workflow).toContain('project.link.repo === GIT_REPOSITORY')
        expect(workflow).toContain('project.link.productionBranch === PRODUCTION_BRANCH')
        expect(workflow).toContain("type: 'plain'")
        expect(workflow).toContain("type: 'sensitive'")
        expect(workflow).toContain("target: ['production']")
        expect(workflow).toContain('&upsert=true')
        expect(workflow).not.toContain('decrypt=true')
        expect(workflow).not.toContain('toJson(')
        expect(workflow).not.toContain('GITHUB_OUTPUT')
        expect(() => new Function(extractManagementScript())).not.toThrow()
    })

    it('applies exactly two Production-only records and emits name-only logs and summary', async () => {
        const result = await runHarness('apply')

        expect(result.exitCode).toBe(0)
        const mutation = result.calls.find((call) => call.method === 'POST')
        expect(mutation).toMatchObject({
            method: 'POST',
            path: '/v10/projects/prj_peanut_wallet/env',
            search: '?teamId=team_squirrellabs&upsert=true',
            body: [
                {
                    key: 'SPLIT_CONTENT_ORIGIN',
                    value: TEST_ORIGIN,
                    type: 'plain',
                    target: ['production'],
                    comment: OWNERSHIP_COMMENT,
                },
                {
                    key: 'SPLIT_CONTENT_EDGE_MARKER',
                    value: TEST_MARKER,
                    type: 'sensitive',
                    target: ['production'],
                    comment: OWNERSHIP_COMMENT,
                },
            ],
        })
        expect(mutation?.headers.authorization).toBe(`Bearer ${TEST_TOKEN}`)
        expect(result.logs).toContain('SPLIT_CONTENT_EDGE_MARKER state=present type=sensitive target=production')
        expect(result.logs).toContain('valuesPrinted=0')
        expect(result.summaries).toHaveLength(1)
        expect(result.summaries[0]).toContain('valuesPrinted=0')
        expectNoSecretOutput(result)
    })

    it('re-applies the same owned state without compensating pre-existing records', async () => {
        const result = await runHarness('apply', { initialRows: desiredRows() })

        expect(result.exitCode).toBe(0)
        expect(result.calls.filter((call) => call.method === 'POST')).toHaveLength(1)
        expect(result.calls.some((call) => call.method === 'DELETE')).toBe(false)
        expectNoSecretOutput(result)
    })

    it('accepts the complete pagination inventory variant and verifies without mutation', async () => {
        const result = await runHarness('verify', {
            initialRows: desiredRows(),
            inventoryVariant: 'pagination',
        })

        expect(result.exitCode).toBe(0)
        expectNoMutations(result)
        expectNoSecretOutput(result)
    })

    it('rolls back only the exact owned record IDs and proves absence', async () => {
        const result = await runHarness('rollback', { initialRows: desiredRows() })

        expect(result.exitCode).toBe(0)
        expect(result.calls.find((call) => call.method === 'DELETE')).toMatchObject({
            method: 'DELETE',
            path: '/v1/projects/prj_peanut_wallet/env',
            search: '?teamId=team_squirrellabs',
            body: { ids: ['env_origin', 'env_marker'] },
        })
        expect(result.rows).toEqual([])
        expectNoSecretOutput(result)
    })

    it('allows guarded rollback of one exact partial managed record', async () => {
        const result = await runHarness('rollback', { initialRows: [desiredRows()[0]] })

        expect(result.exitCode).toBe(0)
        expect(result.calls.find((call) => call.method === 'DELETE')?.body).toEqual({
            ids: ['env_origin'],
        })
        expect(result.rows).toEqual([])
        expectNoSecretOutput(result)
    })

    it.each([
        [
            'wrong type',
            () => {
                const rows = desiredRows()
                rows[1].type = 'encrypted'
                return rows
            },
        ],
        [
            'duplicate managed key',
            () => {
                const rows = desiredRows()
                rows[1] = { ...rows[0], id: 'env_origin_duplicate' }
                return rows
            },
        ],
        [
            'duplicate record ID',
            () => {
                const rows = desiredRows()
                rows[1].id = rows[0].id
                return rows
            },
        ],
        [
            'shared configuration link',
            () => {
                const rows = desiredRows()
                rows[0].configurationId = 'env_shared_configuration'
                return rows
            },
        ],
        [
            'system binding',
            () => {
                const rows = desiredRows()
                rows[0].system = true
                return rows
            },
        ],
        [
            'edge config link',
            () => {
                const rows = desiredRows()
                rows[0].edgeConfigId = 'ecfg_link'
                return rows
            },
        ],
        [
            'branch scope',
            () => {
                const rows = desiredRows()
                rows[0].gitBranch = 'main'
                return rows
            },
        ],
        [
            'custom environment scope',
            () => {
                const rows = desiredRows()
                rows[0].customEnvironmentIds = ['env_custom']
                return rows
            },
        ],
        [
            'mixed target scope',
            () => {
                const rows = desiredRows()
                rows[0].target = ['production', 'preview']
                return rows
            },
        ],
        [
            'foreign comment',
            () => {
                const rows = desiredRows()
                rows[0].comment = 'owned elsewhere'
                return rows
            },
        ],
    ])('refuses rollback for %s without sending a delete', async (_label, makeRows) => {
        const result = await runHarness('rollback', { initialRows: makeRows() })

        expect(result.exitCode).toBe(1)
        expect(result.calls.some((call) => call.method === 'DELETE')).toBe(false)
        expectNoSecretOutput(result)
    })

    it('rejects foreign state before apply mutation', async () => {
        const foreignRows = desiredRows()
        foreignRows[1].comment = 'owned elsewhere'
        const result = await runHarness('apply', { initialRows: foreignRows })

        expect(result.exitCode).toBe(1)
        expectNoMutations(result)
        expect(result.errors.join('\n')).toContain('foreign or malformed')
        expectNoSecretOutput(result)
    })

    it.each([
        ['team identity', { teamOverrides: { slug: 'other-team' } }],
        ['project identity', { projectOverrides: { name: 'other-project' } }],
        ['Git organization', { projectLinkOverrides: { org: 'other-org' } }],
        ['Git repository', { projectLinkOverrides: { repo: 'other-repo' } }],
        ['Production Branch', { projectLinkOverrides: { productionBranch: 'dev' } }],
    ])('rejects a mismatched %s before an environment request', async (_label, options) => {
        const result = await runHarness('apply', options)

        expect(result.exitCode).toBe(1)
        expect(result.calls.some((call) => call.path.endsWith('/env'))).toBe(false)
        expectNoSecretOutput(result)
    })

    it.each([
        ['GitHub Actions runtime', { GITHUB_ACTIONS: 'false' }],
        ['event', { GITHUB_EVENT_NAME: 'push' }],
        ['repository', { GITHUB_REPOSITORY: 'attacker/fork' }],
        ['repository ID', { GITHUB_REPOSITORY_ID: '999' }],
        ['dispatch actor login', { GITHUB_ACTOR: 'other-user' }],
        ['dispatch actor ID', { GITHUB_ACTOR_ID: '999' }],
        ['rerun attempt', { GITHUB_RUN_ATTEMPT: '2' }],
        ['triggering actor login', { GITHUB_TRIGGERING_ACTOR: 'other-user' }],
        ['triggering actor ID', { TRIGGERING_ACTOR_ID: '999' }],
        ['temporary ref', { GITHUB_REF: 'refs/heads/main' }],
        ['workflow identity', { GITHUB_WORKFLOW_REF: 'attacker/workflow@refs/heads/main' }],
        ['checked-out workflow SHA', { GITHUB_SHA: '2'.repeat(40) }],
        ['workflow source SHA', { GITHUB_WORKFLOW_SHA: '2'.repeat(40) }],
        ['origin policy', { SPLIT_CONTENT_ORIGIN: 'https://evil.example' }],
        ['marker format', { SPLIT_CONTENT_EDGE_MARKER: 'a'.repeat(63) }],
        ['marker digest', { SPLIT_CONTENT_EDGE_MARKER: 'b'.repeat(64) }],
        ['Vercel credential presence', { VERCEL_TOKEN: '' }],
    ])('binds the %s guard before any Vercel request', async (_label, envOverrides) => {
        const result = await runHarness('preflight', { envOverrides })

        expect(result.exitCode).toBe(1)
        expect(result.calls).toEqual([])
        expectNoSecretOutput(result)
    })

    it('rejects both reruns and a different rerun initiator before any Vercel request', async () => {
        const result = await runHarness('preflight', {
            envOverrides: {
                GITHUB_RUN_ATTEMPT: '2',
                GITHUB_TRIGGERING_ACTOR: 'other-user',
                TRIGGERING_ACTOR_ID: '999',
            },
        })

        expect(result.exitCode).toBe(1)
        expect(result.calls).toEqual([])
        expect(result.errors).toEqual(['::error::Workflow reruns are forbidden for environment operations.'])
        expectNoSecretOutput(result)
    })

    it.each([
        ['stale approval SHA', 'preflight', { expectedWorkflowSha: '2'.repeat(40) }],
        ['malformed approval SHA', 'preflight', { expectedWorkflowSha: 'not-a-sha' }],
        ['unsupported operation', 'destroy', {}],
    ])('rejects %s before any Vercel request', async (_label, operation, options) => {
        const result = await runHarness(operation, options)

        expect(result.exitCode).toBe(1)
        expect(result.calls).toEqual([])
        expectNoSecretOutput(result)
    })

    it.each([
        ['raw array', desiredRows()],
        ['single record', desiredRows()[0]],
        ['missing inventory discriminator', { envs: [] }],
        ['missing envs', { hiddenProductionEnvCount: 0 }],
        [
            'two inventory discriminators',
            {
                envs: [],
                hiddenProductionEnvCount: 0,
                pagination: { count: 0, next: null, prev: null },
            },
        ],
        ['positive hidden count', { envs: [], hiddenProductionEnvCount: 1 }],
        ['negative hidden count', { envs: [], hiddenProductionEnvCount: -1 }],
        ['NaN hidden count', { envs: [], hiddenProductionEnvCount: Number.NaN }],
        ['string hidden count', { envs: [], hiddenProductionEnvCount: '0' }],
        ['pagination missing next', { envs: [], pagination: { count: 0, prev: null } }],
        ['pagination with next cursor', { envs: [], pagination: { count: 0, next: 123, prev: null } }],
        ['pagination with negative count', { envs: [], pagination: { count: -1, next: null, prev: null } }],
        ['pagination with NaN count', { envs: [], pagination: { count: Number.NaN, next: null, prev: null } }],
        ['pagination with mismatched count', { envs: [], pagination: { count: 1, next: null, prev: null } }],
        ['pagination with previous cursor', { envs: [], pagination: { count: 0, next: null, prev: 123 } }],
        ['malformed environment record', { envs: [{ key: 'SPLIT_CONTENT_ORIGIN' }], hiddenProductionEnvCount: 0 }],
    ])('fails closed for %s', async (_label, inventoryResponse) => {
        const result = await runHarness('preflight', { inventoryResponse })

        expect(result.exitCode).toBe(1)
        expectNoMutations(result)
        expectNoSecretOutput(result)
    })

    it.each([
        ['missing wrapper', null],
        ['missing created', { failed: [] }],
        ['created is a single object', { created: desiredRows()[0], failed: [] }],
        ['only one created record', { created: [desiredRows()[0]], failed: [] }],
        [
            'created record missing its official value field',
            {
                created: [desiredRows()[0], { ...desiredRows()[1], value: undefined }],
                failed: [],
            },
        ],
        [
            'duplicate created key',
            { created: [desiredRows()[0], { ...desiredRows()[0], id: 'env_duplicate' }], failed: [] },
        ],
        [
            'wrong created type',
            {
                created: [desiredRows()[0], { ...desiredRows()[1], type: 'encrypted' }],
                failed: [],
            },
        ],
        [
            'wrong created target',
            { created: [desiredRows()[0], { ...desiredRows()[1], target: ['preview'] }], failed: [] },
        ],
        [
            'foreign created comment',
            { created: [desiredRows()[0], { ...desiredRows()[1], comment: 'foreign' }], failed: [] },
        ],
        [
            'created shared link',
            {
                created: [desiredRows()[0], { ...desiredRows()[1], configurationId: 'shared' }],
                failed: [],
            },
        ],
        [
            'nonempty failed records',
            {
                created: desiredRows(),
                failed: [{ error: { message: TEST_RESPONSE_SECRET, value: TEST_MARKER } }],
            },
        ],
    ])('rejects apply response with %s and compensates newly-created state', async (_label, postResponse) => {
        const result = await runHarness('apply', { postResponse })

        expect(result.exitCode).toBe(1)
        expect(result.calls.some((call) => call.method === 'POST')).toBe(true)
        expect(result.calls.some((call) => call.method === 'DELETE')).toBe(true)
        expect(result.rows).toEqual([])
        expectNoSecretOutput(result)
    })

    it('does not compensate or delete when an apply response fails over pre-existing managed state', async () => {
        const result = await runHarness('apply', {
            initialRows: desiredRows(),
            postRows: desiredRows(),
            postResponse: { created: [desiredRows()[0]], failed: [] },
        })

        expect(result.exitCode).toBe(1)
        expect(result.calls.some((call) => call.method === 'POST')).toBe(true)
        expect(result.calls.some((call) => call.method === 'DELETE')).toBe(false)
        expect(result.rows).toEqual(desiredRows())
        expectNoSecretOutput(result)
    })

    it('compensates an initial partial apply using one exact desired owned record', async () => {
        const result = await runHarness('apply', {
            postRows: [desiredRows()[0]],
            postResponse: {
                created: [desiredRows()[0]],
                failed: [{ error: { message: TEST_RESPONSE_SECRET } }],
            },
        })

        expect(result.exitCode).toBe(1)
        expect(result.calls.some((call) => call.method === 'POST')).toBe(true)
        expect(result.calls.find((call) => call.method === 'DELETE')?.body).toEqual({
            ids: ['env_origin'],
        })
        expect(result.rows).toEqual([])
        expectNoSecretOutput(result)
    })

    it.each([
        ['wrong type', () => [{ ...desiredRows()[0], type: 'encrypted' }]],
        ['duplicate key', () => [desiredRows()[0], { ...desiredRows()[0], id: 'env_duplicate' }]],
        [
            'duplicate ID',
            () => {
                const rows = desiredRows()
                rows[1].id = rows[0].id
                return rows
            },
        ],
        ['shared binding', () => [{ ...desiredRows()[0], configurationId: 'shared' }]],
    ])('refuses unsafe compensation for %s and sends no delete', async (_label, makeRows) => {
        const result = await runHarness('apply', {
            postRows: makeRows(),
            postResponse: {
                created: [],
                failed: [{ error: { message: TEST_RESPONSE_SECRET } }],
            },
        })

        expect(result.exitCode).toBe(1)
        expect(result.calls.some((call) => call.method === 'POST')).toBe(true)
        expect(result.calls.some((call) => call.method === 'DELETE')).toBe(false)
        expect(result.errors).toContain('::error::Apply failed and guarded compensation could not prove cleanup.')
        expectNoSecretOutput(result)
    })

    it('discards Vercel failure bodies and never leaks request headers or secrets', async () => {
        const result = await runHarness('preflight', {
            apiFailure: {
                method: 'GET',
                path: '/v9/projects/peanut-wallet',
                status: 500,
            },
        })

        expect(result.exitCode).toBe(1)
        expect(result.calls[0].headers.authorization).toBe(`Bearer ${TEST_TOKEN}`)
        expect(result.errors).toEqual(['::error::Vercel API GET /v9/projects/peanut-wallet failed with HTTP 500.'])
        expect(result.summaries).toEqual([])
        expectNoSecretOutput(result)
    })
})
