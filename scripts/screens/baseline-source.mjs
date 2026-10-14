import { verifiedExternalBaselineSource } from './baseline-runs.mjs'

/** Bounded pagination is explicit: overflow is an error, never proof of absence. */
export function pages(api, path, key, budget = 20) {
    const values = []
    for (let page = 1; page <= budget; page++) {
        const result = api(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`)
        const entries = result?.[key]
        if (!Array.isArray(entries)) throw new Error(`Invalid GitHub ${key} response`)
        values.push(...entries)
        if (entries.length < 100) return values
    }
    throw new Error(`GitHub ${key} pagination exceeded ${budget} pages`)
}

export function verifyBaselineSource({ api, repository, expectedCommit, run }) {
    const defaultBranch = api('').default_branch
    const artifacts = pages(api, `actions/runs/${run.id}/artifacts`, 'artifacts')
    const jobs =
        run.path === '.github/workflows/screen-library.yml' ? pages(api, `actions/runs/${run.id}/jobs`, 'jobs') : []
    return verifiedExternalBaselineSource({ run, jobs, artifacts, repository, expectedCommit, defaultBranch })
}

export function findBaselineSource({ api, repository, expectedCommit, log = console.log, now = Date.now }) {
    if (!/^[a-f0-9]{40}$/.test(expectedCommit)) throw new Error('Invalid baseline revision')
    const started = now(),
        deadline = started + 120000
    const provider = api
    let requests = 0
    api = (path) => {
        if (now() >= deadline)
            throw new Error('Baseline cache lookup exceeded its 120-second deadline; availability unknown')
        if (requests++ % 10 === 0)
            log(
                `Baseline lookup phase=provider requests=${requests} elapsed=${Math.round((now() - started) / 1000)}s budget=120s`
            )
        const result = provider(path)
        if (now() >= deadline)
            throw new Error('Baseline cache lookup exceeded its 120-second deadline; availability unknown')
        return result
    }
    const integration = pages(api, `actions/runs?head_sha=${expectedCommit}`, 'workflow_runs').sort(
        (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)
    )
    for (const run of integration) {
        if (
            run.path !== '.github/workflows/screen-library.yml' ||
            run.event !== 'push' ||
            !['dev', 'main'].includes(run.head_branch)
        )
            continue
        const verified = verifyBaselineSource({ api, repository, expectedCommit, run })
        if (verified?.kind === 'integration') return { run, ...verified }
    }
    // Match the existing resolver's recent scheduled-run window. This is a cache lookup,
    // not an assertion that no older capture exists; a miss requests fresh capture once.
    const defaultBranch = api('').default_branch
    const runs = ['push', 'schedule', 'workflow_dispatch']
        .flatMap((event) => {
            const response = api(`actions/runs?branch=${encodeURIComponent(defaultBranch)}&event=${event}&per_page=100`)
            if (!Array.isArray(response.workflow_runs)) throw new Error('Invalid baseline workflow-runs response')
            return response.workflow_runs
        })
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    log(
        `Baseline cache search: ${integration.length} exact-revision runs and ${runs.length} recent default-branch runs`
    )
    for (const run of runs) {
        if (run.path !== '.github/workflows/screen-library-baseline.yml') continue
        const verified = verifyBaselineSource({ api, repository, expectedCommit, run })
        if (verified?.kind === 'baseline') return { run, ...verified }
    }
    return null
}
