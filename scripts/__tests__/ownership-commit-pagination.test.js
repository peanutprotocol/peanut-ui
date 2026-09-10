/** @jest-environment node */
const fs = require('node:fs')
const path = require('node:path')

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor

function workflowScript(name) {
    const source = fs.readFileSync(path.join(__dirname, '../../.github/workflows', name), 'utf8')
    const start = source.indexOf('                      const ALLOWED_BOTS')
    const lines = source.slice(start).split('\n')
    const end = lines.findIndex((line) => line.trim() && !line.startsWith('                      '))
    return new AsyncFunction(
        'github',
        'context',
        'core',
        lines
            .slice(0, end < 0 ? undefined : end)
            .map((line) => line.slice(22))
            .join('\n')
    )
}

function harness({
    count = 493,
    badLast = false,
    botLast = false,
    duplicate = false,
    truncate = false,
    missingCount = false,
} = {}) {
    const commits = Array.from({ length: count }, (_, i) => ({
        sha: `commit-${i}`,
        author: { login: 'teammate' },
        commit: { author: { email: 'team@example.com' }, message: 'A change' },
    }))
    if (badLast) commits[count - 1].author = null
    if (botLast) commits[count - 1].author.login = 'chip-peanut-bot[bot]'
    if (duplicate) commits[count - 1] = commits[0]
    const comparisonCalls = []
    const github = {
        rest: {
            repos: {
                getCollaboratorPermissionLevel: jest.fn(async () => ({ data: { permission: 'write' } })),
                compareCommitsWithBasehead: jest.fn(async (args) => {
                    if (!args.page) return { data: { status: 'ahead' } }
                    comparisonCalls.push(args)
                    return {
                        data: {
                            total_commits: missingCount ? undefined : count,
                            commits:
                                truncate && args.page > 2 ? [] : commits.slice((args.page - 1) * 100, args.page * 100),
                        },
                    }
                }),
            },
        },
    }
    const context = {
        repo: { owner: 'owner', repo: 'repo' },
        payload: {
            pull_request: {
                base: { sha: 'base-sha', ref: 'tech-debt' },
                head: { sha: 'head-sha' },
                commits: count,
                user: { login: 'teammate', type: 'User' },
                assignees: [],
            },
        },
    }
    const core = { setFailed: jest.fn(), warning: jest.fn() }
    return { github, context, core, comparisonCalls }
}

for (const name of ['tests.yml', 'bot-approval.yml']) {
    describe(name, () => {
        const run = workflowScript(name)
        test('checks all 493 commits using immutable SHAs', async () => {
            const h = harness()
            await run(h.github, h.context, h.core)
            expect(h.core.setFailed).not.toHaveBeenCalled()
            expect(h.comparisonCalls.map((c) => c.page)).toEqual([1, 2, 3, 4, 5])
            expect(h.comparisonCalls.every((c) => c.basehead === 'base-sha...head-sha')).toBe(true)
        })
        test.each([{ duplicate: true }, { truncate: true }, { missingCount: true }])(
            'fails closed on invalid enumeration: %j',
            async (options) => {
                const h = harness(options)
                await expect(run(h.github, h.context, h.core)).rejects.toThrow()
            }
        )
        test('still rejects an invalid author or bot past commit 250', async () => {
            const h = harness(name === 'tests.yml' ? { badLast: true } : { botLast: true })
            await run(h.github, h.context, h.core)
            expect(h.core.setFailed).toHaveBeenCalled()
            expect(h.core.setFailed.mock.calls[0][0]).toContain('commit-')
        })
        test('fails closed when the event count differs', async () => {
            const h = harness()
            h.context.payload.pull_request.commits++
            await expect(run(h.github, h.context, h.core)).rejects.toThrow('Incomplete')
        })
        test('supports review events without a commit count', async () => {
            const h = harness({ count: 1 })
            delete h.context.payload.pull_request.commits
            await run(h.github, h.context, h.core)
            expect(h.core.setFailed).not.toHaveBeenCalled()
        })
    })
}
