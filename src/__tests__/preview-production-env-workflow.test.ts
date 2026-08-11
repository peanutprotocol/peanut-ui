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
const TEST_SHA = '1'.repeat(40)

type EnvRow = {
    id: string
    key: 'SPLIT_CONTENT_ORIGIN' | 'SPLIT_CONTENT_EDGE_MARKER'
    value: string
    type: 'plain' | 'sensitive'
    target: string[]
    comment: string
    gitBranch?: string | null
    customEnvironmentIds?: string[]
}

type ApiCall = {
    method: string
    path: string
    search: string
    body?: unknown
}

type HarnessOptions = {
    initialRows?: EnvRow[]
    expectedWorkflowSha?: string
    postFailure?: 'partial'
    projectLinkOverrides?: Partial<{
        type: string
        org: string
        repo: string
        productionBranch: string
    }>
    teamSlug?: string
    hiddenProductionEnvCount?: number
    paginationNext?: number
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

async function runHarness(operation: 'preflight' | 'apply' | 'verify' | 'rollback', options: HarnessOptions = {}) {
    let rows = structuredClone(options.initialRows ?? [])
    const calls: ApiCall[] = []
    const logs: string[] = []
    const errors: string[] = []

    const response = (payload: unknown, status = 200) => ({
        ok: status >= 200 && status < 300,
        status,
        json: async () => structuredClone(payload),
        arrayBuffer: async () => new ArrayBuffer(0),
    })

    const fetchMock = jest.fn(async (input: string, init: RequestInit = {}) => {
        const url = new URL(input)
        const method = (init.method ?? 'GET').toUpperCase()
        const body = init.body ? JSON.parse(String(init.body)) : undefined
        calls.push({ method, path: url.pathname, search: url.search, body })

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
            })
        }
        if (method === 'GET' && url.pathname === '/v2/teams/team_squirrellabs') {
            return response({
                id: 'team_squirrellabs',
                slug: options.teamSlug ?? 'squirrellabs',
            })
        }
        if (method === 'GET' && url.pathname === '/v10/projects/prj_peanut_wallet/env') {
            return response({
                envs: structuredClone(rows),
                hiddenProductionEnvCount: options.hiddenProductionEnvCount ?? 0,
                pagination: {
                    count: rows.length,
                    next: options.paginationNext ?? null,
                    prev: null,
                },
            })
        }
        if (method === 'POST' && url.pathname === '/v10/projects/prj_peanut_wallet/env') {
            const records = body as Array<Omit<EnvRow, 'id'>>
            if (options.postFailure === 'partial') {
                rows = [{ ...records[0], id: 'env_partial_origin' }]
                return response({
                    created: structuredClone(rows),
                    failed: [{ error: { code: 'TEST_FAILURE', message: TEST_MARKER } }],
                })
            }
            rows = records.map((record, index) => ({
                ...record,
                id: index === 0 ? 'env_origin' : 'env_marker',
            }))
            return response({ created: structuredClone(rows), failed: [] }, 201)
        }
        if (method === 'DELETE' && url.pathname === '/v1/projects/prj_peanut_wallet/env') {
            const ids = (body as { ids: string[] }).ids
            rows = rows.filter((row) => !ids.includes(row.id))
            return response({ deleted: ids.length, ids })
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
            SPLIT_CONTENT_ORIGIN: TEST_ORIGIN,
            SPLIT_CONTENT_EDGE_MARKER: TEST_MARKER,
            VERCEL_TOKEN: TEST_TOKEN,
            GITHUB_ACTIONS: 'true',
            GITHUB_EVENT_NAME: 'workflow_dispatch',
            GITHUB_REPOSITORY: 'peanutprotocol/peanut-ui',
            GITHUB_REF: 'refs/heads/ops/split-b3a-vercel-production-env',
            GITHUB_SHA: TEST_SHA,
            GITHUB_ACTOR: '0xkkonrad',
            GITHUB_ACTOR_ID: '10008415',
        },
        exitCode: 0,
    }
    const sandbox: Record<string, unknown> = {
        require,
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

    return { calls, errors, exitCode: fakeProcess.exitCode, logs, rows }
}

function expectNoSecretOutput(logs: string[], errors: string[]) {
    const output = [...logs, ...errors].join('\n')
    expect(output).not.toContain(TEST_MARKER)
    expect(output).not.toContain(TEST_TOKEN)
    expect(output).not.toContain(TEST_ORIGIN)
}

describe('temporary Split Production environment workflow contract', () => {
    it('preserves Preview behavior and pins every production guard in executable syntax', () => {
        expect(workflow).toContain('default: preview')
        expect(workflow).toContain("if: github.event_name == 'pull_request' || inputs.operation == 'preview'")
        expect(workflow).toContain('run: vercel build --target=preview --token=${{ secrets.VERCEL_TOKEN }}')
        expect(workflow).toContain(
            'run: vercel deploy --prebuilt --archive=tgz --target=preview --scope=squirrellabs --token=${{ secrets.VERCEL_TOKEN }}'
        )
        expect(workflow).toContain('refs/heads/ops/split-b3a-vercel-production-env')
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
        expect(() => new Function(extractManagementScript())).not.toThrow()
    })

    it('applies exactly two Production-only records and emits name-only results', async () => {
        const result = await runHarness('apply')

        expect(result.exitCode).toBe(0)
        const mutation = result.calls.find((call) => call.method === 'POST')
        expect(mutation).toEqual({
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
        expect(result.logs).toContain('SPLIT_CONTENT_EDGE_MARKER state=present type=sensitive target=production')
        expect(result.logs).toContain('valuesPrinted=0')
        expectNoSecretOutput(result.logs, result.errors)
    })

    it('re-applies the same owned state idempotently without rollback', async () => {
        const result = await runHarness('apply', { initialRows: desiredRows() })

        expect(result.exitCode).toBe(0)
        expect(result.calls.filter((call) => call.method === 'POST')).toHaveLength(1)
        expect(result.calls.some((call) => call.method === 'DELETE')).toBe(false)
        expectNoSecretOutput(result.logs, result.errors)
    })

    it('verifies managed state without making a mutation', async () => {
        const result = await runHarness('verify', { initialRows: desiredRows() })

        expect(result.exitCode).toBe(0)
        expect(result.calls.every((call) => call.method === 'GET')).toBe(true)
        expectNoSecretOutput(result.logs, result.errors)
    })

    it('rolls back only the exact owned record IDs and proves absence', async () => {
        const result = await runHarness('rollback', { initialRows: desiredRows() })

        expect(result.exitCode).toBe(0)
        expect(result.calls.find((call) => call.method === 'DELETE')).toEqual({
            method: 'DELETE',
            path: '/v1/projects/prj_peanut_wallet/env',
            search: '?teamId=team_squirrellabs',
            body: { ids: ['env_origin', 'env_marker'] },
        })
        expect(result.rows).toEqual([])
        expectNoSecretOutput(result.logs, result.errors)
    })

    it('rejects foreign state before mutation', async () => {
        const foreignRows = desiredRows()
        foreignRows[1].comment = 'owned elsewhere'
        const result = await runHarness('apply', { initialRows: foreignRows })

        expect(result.exitCode).toBe(1)
        expect(result.calls.every((call) => call.method === 'GET')).toBe(true)
        expect(result.errors.join('\n')).toContain('foreign or malformed')
        expectNoSecretOutput(result.logs, result.errors)
    })

    it.each([
        ['team identity', { teamSlug: 'other-team' }],
        ['Git organization', { projectLinkOverrides: { org: 'other-org' } }],
        ['Git repository', { projectLinkOverrides: { repo: 'other-repo' } }],
        ['Production Branch', { projectLinkOverrides: { productionBranch: 'dev' } }],
    ])('rejects a mismatched %s before an environment request', async (_label, options) => {
        const result = await runHarness('apply', options)

        expect(result.exitCode).toBe(1)
        expect(result.calls.some((call) => call.path.endsWith('/env'))).toBe(false)
        expectNoSecretOutput(result.logs, result.errors)
    })

    it.each([
        ['hidden', { hiddenProductionEnvCount: 1 }],
        ['paginated', { paginationNext: 123456789 }],
    ])('fails closed on an incomplete %s environment audit', async (_label, options) => {
        const result = await runHarness('apply', options)

        expect(result.exitCode).toBe(1)
        expect(result.calls.every((call) => call.method === 'GET')).toBe(true)
        expectNoSecretOutput(result.logs, result.errors)
    })

    it('compensates an initial partial apply using only its ownership marker', async () => {
        const result = await runHarness('apply', { postFailure: 'partial' })

        expect(result.exitCode).toBe(1)
        expect(result.calls.some((call) => call.method === 'POST')).toBe(true)
        expect(result.calls.some((call) => call.method === 'DELETE')).toBe(true)
        expect(result.rows).toEqual([])
        expectNoSecretOutput(result.logs, result.errors)
    })

    it('rejects a stale approval SHA before any Vercel request', async () => {
        const result = await runHarness('preflight', {
            expectedWorkflowSha: '2'.repeat(40),
        })

        expect(result.exitCode).toBe(1)
        expect(result.calls).toEqual([])
        expect(result.errors).toEqual(['::error::Workflow SHA does not match the explicitly approved commit.'])
        expectNoSecretOutput(result.logs, result.errors)
    })
})
