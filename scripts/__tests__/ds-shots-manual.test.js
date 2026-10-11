/** @jest-environment node */

const fs = require('node:fs')
const path = require('node:path')
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const workflow = (file) => fs.readFileSync(path.join(__dirname, '../../.github/workflows', file), 'utf8')
const script = (file) =>
    workflow(file)
        .split('                  script: |\n')[1]
        .match(/^(?: {22}.*\n|\n)+/)[0]
        .split('\n')
        .filter((line) => line.startsWith('                      '))
        .map((line) => line.slice(22))
        .join('\n')

function harness({
    permission = 'write',
    state = 'open',
    headRepo = 'peanutprotocol/peanut-ui',
    body = '/ds-shots',
} = {}) {
    const pr = {
        number: 42,
        state,
        head: { repo: { full_name: headRepo }, ref: 'feature/example', sha: 'a'.repeat(40) },
        base: { sha: 'b'.repeat(40) },
    }
    const context = {
        repo: { owner: 'peanutprotocol', repo: 'peanut-ui' },
        issue: { number: 42 },
        payload: { comment: { body, user: { login: 'teammate' } } },
        sha: pr.head.sha,
        ref: `refs/heads/${pr.head.ref}`,
    }
    const github = {
        rest: {
            repos: { getCollaboratorPermissionLevel: jest.fn().mockResolvedValue({ data: { permission } }) },
            pulls: { get: jest.fn().mockResolvedValue({ data: pr }) },
            actions: { createWorkflowDispatch: jest.fn().mockResolvedValue({}) },
        },
    }
    const core = { notice: jest.fn(), setOutput: jest.fn() }
    return { pr, context, github, core }
}

const request = new AsyncFunction('github', 'context', 'core', script('ds-shots-request.yml'))
const prepare = new AsyncFunction('github', 'context', 'core', script('ds-shots.yml'))

function condition(job) {
    const block = workflow('tests.yml').split(`    ${job}:\n`)[1]
    const expression = block.match(/        if: >-\n((?:            .*\n)+)/)[1].trim()
    const javascript = expression.replace(/needs\.([a-z-]+)/g, 'needs["$1"]')
    return new Function('github', 'needs', 'always', 'contains', 'fromJSON', `return ${javascript}`)
}

function automatic(event, ref, base = 'dev') {
    const github = {
        event_name: event,
        ref_name: ref,
        repository: 'peanutprotocol/peanut-ui',
        event: { pull_request: { base: { ref: base }, head: { repo: { full_name: 'peanutprotocol/peanut-ui' } } } },
    }
    const helpers = [() => true, (array, value) => array.includes(value), JSON.parse]
    const render = event === 'pull_request' && condition('ds-shots-filter')(github, {}, ...helpers)
    return condition('ds-shots')(
        github,
        { 'backdoor-scan': { result: 'success' }, 'ds-shots-filter': { outputs: { render: String(render) } } },
        ...helpers
    )
}

describe('automatic visual capture policy', () => {
    it('does not capture dev pushes or PRs targeting dev', () => {
        expect(automatic('push', 'dev')).toBe(false)
        expect(automatic('pull_request', 'feature/example', 'dev')).toBe(false)
        expect(automatic('workflow_dispatch', 'dev')).toBe(false)
    })

    it('preserves main and design-system captures and other PR bases', () => {
        expect(automatic('push', 'main')).toBe(true)
        expect(automatic('push', 'feat/design-system')).toBe(true)
        expect(automatic('pull_request', 'feature/example', 'main')).toBe(true)
        expect(automatic('push', 'tech-debt')).toBe(false)
    })
})

describe('/ds-shots request', () => {
    it.each(['write', 'maintain', 'admin'])('dispatches the live head for %s access', async (permission) => {
        const h = harness({ permission })
        await request(h.github, h.context, h.core)
        expect(h.github.rest.repos.getCollaboratorPermissionLevel).toHaveBeenCalledWith({
            ...h.context.repo,
            username: 'teammate',
        })
        expect(h.github.rest.actions.createWorkflowDispatch).toHaveBeenCalledWith({
            ...h.context.repo,
            workflow_id: 'ds-shots.yml',
            ref: 'feature/example',
            inputs: { pr_number: '42', expected_head: h.pr.head.sha },
        })
    })

    it.each(['read', 'triage', 'none'])('rejects %s access before looking up the PR', async (permission) => {
        const h = harness({ permission })
        await request(h.github, h.context, h.core)
        expect(h.github.rest.pulls.get).not.toHaveBeenCalled()
        expect(h.github.rest.actions.createWorkflowDispatch).not.toHaveBeenCalled()
    })

    it.each([{ state: 'closed' }, { headRepo: 'outsider/peanut-ui' }, { headRepo: null }])(
        'rejects an ineligible PR: %j',
        async (options) => {
            const h = harness(options)
            await request(h.github, h.context, h.core)
            expect(h.github.rest.actions.createWorkflowDispatch).not.toHaveBeenCalled()
        }
    )

    it.each(['/ds-shots extra', 'please /ds-shots', '/DS-SHOTS', '`/ds-shots`'])(
        'requires the exact command: %s',
        async (body) => {
            const h = harness({ body })
            await request(h.github, h.context, h.core)
            expect(h.github.rest.repos.getCollaboratorPermissionLevel).not.toHaveBeenCalled()
            expect(h.github.rest.actions.createWorkflowDispatch).not.toHaveBeenCalled()
        }
    )

    it('fails visibly on an API error instead of dispatching', async () => {
        const h = harness()
        h.github.rest.repos.getCollaboratorPermissionLevel.mockRejectedValue(new Error('rate limited'))
        await expect(request(h.github, h.context, h.core)).rejects.toThrow('rate limited')
        expect(h.github.rest.actions.createWorkflowDispatch).not.toHaveBeenCalled()
    })
})

describe('manual capture identity', () => {
    const savedEnv = { PR_NUMBER: process.env.PR_NUMBER, EXPECTED_HEAD: process.env.EXPECTED_HEAD }
    beforeEach(() => {
        process.env.PR_NUMBER = '42'
        process.env.EXPECTED_HEAD = 'a'.repeat(40)
    })
    afterAll(() => {
        for (const [key, value] of Object.entries(savedEnv)) {
            if (value === undefined) delete process.env[key]
            else process.env[key] = value
        }
    })

    it('resolves the exact base and head SHAs', async () => {
        const h = harness()
        await prepare(h.github, h.context, h.core)
        expect(h.core.setOutput.mock.calls).toEqual([
            ['head', h.pr.head.sha],
            ['base', h.pr.base.sha],
        ])
    })

    it('allows a direct dispatch without the optional expected head', async () => {
        process.env.EXPECTED_HEAD = ''
        const h = harness()
        await prepare(h.github, h.context, h.core)
        expect(h.core.setOutput).toHaveBeenCalledTimes(2)
    })

    it.each(['', '-42', '42;echo unsafe', 'not-a-pr'])('rejects invalid PR input: %s', async (number) => {
        process.env.PR_NUMBER = number
        const h = harness()
        await expect(prepare(h.github, h.context, h.core)).rejects.toThrow('Invalid PR number')
        expect(h.github.rest.pulls.get).not.toHaveBeenCalled()
    })

    it.each(['sha', 'ref'])('rejects a dispatch from the wrong %s', async (field) => {
        const h = harness()
        h.context[field] = 'different'
        await expect(prepare(h.github, h.context, h.core)).rejects.toThrow('Run this workflow from the PR head branch')
        expect(h.core.setOutput).not.toHaveBeenCalled()
    })

    it('rejects a PR that changed between comment and dispatch', async () => {
        process.env.EXPECTED_HEAD = 'c'.repeat(40)
        const h = harness()
        await expect(prepare(h.github, h.context, h.core)).rejects.toThrow('The PR changed after the request')
        expect(h.core.setOutput).not.toHaveBeenCalled()
    })

    it.each([{ state: 'closed' }, { headRepo: 'outsider/peanut-ui' }])(
        'rejects an ineligible manual PR: %j',
        async (options) => {
            const h = harness(options)
            await expect(prepare(h.github, h.context, h.core)).rejects.toThrow('Only open same-repository PRs')
            expect(h.core.setOutput).not.toHaveBeenCalled()
        }
    )
})
