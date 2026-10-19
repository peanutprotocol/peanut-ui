import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ALL_LOCALES_LABEL, CAPTURE_LOCALES, missingLocales, planCaptureLocales } from './capture-locales.mjs'
import { evaluateZeroDifferenceGate } from './zero-difference-gate.mjs'
import { completeBaselineArtifacts, trustedIntegrationBaselineRun } from './baseline-runs.mjs'

const sha = 'a'.repeat(40)
const repository = 'peanutprotocol/peanut-ui'
const pr = (changedFiles, labels = []) =>
    planCaptureLocales({ event: 'pull_request', branch: 'dev', changedFiles, labels }).locales

test('PRs and dev pushes capture English unless a locale has its own change', () => {
    assert.deepEqual(pr(['src/features/payments/Review.tsx']), ['en'])
    assert.deepEqual(pr(['src/i18n/app/messages/en.json']), ['en'])
    assert.deepEqual(
        planCaptureLocales({ event: 'push', branch: 'dev', changedFiles: ['src/components/Card.tsx'] }).locales,
        ['en']
    )
})

test('translation fixes and locale-named app files add their locale', () => {
    assert.deepEqual(pr(['src/i18n/app/messages/pt-BR.json']), ['en', 'pt-BR'])
    assert.deepEqual(pr(['src/i18n/app/messages/es-AR.json']), ['en', 'es-AR'])
    assert.deepEqual(pr(['src/features/qr-pay/es-ar/MerchantTip.tsx', 'public/wallet/google/pt-BR.svg']), [
        'en',
        'es-AR',
        'pt-BR',
    ])
})

test('translations that change with the English app catalogue are reviewed in English', () => {
    const feature = [
        'src/components/Card.tsx',
        'src/i18n/app/messages/en.json',
        'src/i18n/app/messages/es-419.json',
        'src/i18n/app/messages/es-AR.json',
        'src/i18n/app/messages/pt-BR.json',
    ]
    assert.deepEqual(pr(feature), ['en'])
    assert.match(
        planCaptureLocales({ event: 'pull_request', branch: 'dev', changedFiles: feature, labels: [] }).reasons.join(
            ' '
        ),
        /reviewed in English: es-419, es-AR, pt-BR/
    )
    assert.deepEqual(pr(['src/i18n/app/messages/en.json', 'public/wallet/google/pt-BR.svg']), ['en', 'pt-BR'])
})

test('marketing catalogues and locale-named marketing pages add their locale, since sitemap pages are captured', () => {
    for (const [path, locales] of [
        ['src/i18n/es-ar.json', ['en', 'es-AR']],
        ['src/i18n/pt-br.json', ['en', 'pt-BR']],
        ['src/i18n/es-419.json', ['en', 'es-419', 'es-AR']],
        ['src/i18n/app/messages/pt-BR.marketing.json', ['en', 'pt-BR']],
        ['src/app/es-ar/page.tsx', ['en', 'es-AR']],
        ['src/app/[locale]/(marketing)/help/page.tsx', ['en']],
        ['src/content', ['en']],
    ])
        assert.deepEqual(pr(['src/components/Card.tsx', path]), locales, path)
    // English marketing copy does not make an app translation fix an English-only review, and vice versa.
    assert.deepEqual(pr(['src/i18n/en.json', 'src/i18n/app/messages/es-AR.json']), ['en', 'es-AR'])
    assert.deepEqual(pr(['src/i18n/app/messages/en.json', 'src/i18n/pt-br.json']), ['en', 'pt-BR'])
    assert.deepEqual(pr(['src/i18n/en.json', 'src/i18n/pt-br.json']), ['en'])
})

test('es-419 copy also renders in es-AR', () => {
    assert.deepEqual(pr(['src/i18n/app/messages/es-419.json']), ['en', 'es-419', 'es-AR'])
    assert.deepEqual(pr(['public/wallet/google/es-419.svg']), ['en', 'es-419', 'es-AR'])
    assert.deepEqual(pr(['src/i18n/app/messages/en.json', 'src/i18n/app/messages/es-419.json']), ['en'])
})

test('shared localization, the label and every release capture all locales', () => {
    for (const path of ['src/i18n/app/IntlCore.tsx', 'src/i18n/app/config.ts'])
        assert.deepEqual(pr([path]), CAPTURE_LOCALES, path)
    assert.deepEqual(pr(['src/components/Card.tsx'], ['bug', ALL_LOCALES_LABEL]), CAPTURE_LOCALES)
    for (const input of [
        { event: 'push', branch: 'main', changedFiles: ['src/components/Card.tsx'] },
        { event: 'workflow_dispatch', branch: 'dev', changedFiles: ['src/components/Card.tsx'] },
        { event: 'pull_request', branch: 'main', changedFiles: ['src/components/Card.tsx'], labels: [] },
    ])
        assert.deepEqual(planCaptureLocales(input).locales, CAPTURE_LOCALES, JSON.stringify(input))
})

test('missing or invalid evidence fails closed to every locale', () => {
    for (const changedFiles of [undefined, null, [], [''], [null]])
        assert.deepEqual(pr(changedFiles), CAPTURE_LOCALES, JSON.stringify(changedFiles))
    for (const labels of [undefined, null, 'screens:all-locales', [1]])
        assert.deepEqual(
            planCaptureLocales({ event: 'pull_request', branch: 'dev', changedFiles: ['src/a.tsx'], labels }).locales,
            CAPTURE_LOCALES
        )
    // Push events carry no PR labels; toJSON() of an absent label list is null.
    assert.deepEqual(
        planCaptureLocales({ event: 'push', branch: 'dev', changedFiles: ['src/a.tsx'], labels: null }).locales,
        ['en']
    )
})

test('nonvisual locale-named paths and tests do not add locales', () => {
    assert.deepEqual(pr(['docs/es-419-glossary.md', 'src/i18n/__tests__/pt-BR.test.ts', 'src/a.tsx']), ['en'])
})

test('a required set is satisfied by any superset of captured locales', () => {
    assert.deepEqual(missingLocales(['en'], CAPTURE_LOCALES), [])
    assert.deepEqual(missingLocales(['en', 'pt-BR'], ['en']), ['pt-BR'])
})

const report = (locale, changedScreens = 1) => ({ locale, complete: true, changedScreens })
const gate = (reports, locales) =>
    evaluateZeroDifferenceGate({
        event: 'pull_request',
        changedFiles: ['src/components/Card.tsx'],
        reports,
        exception: '',
        ...(locales ? { locales } : {}),
    })

test('the coverage gate requires exactly the trusted locales, not all four', () => {
    assert.equal(gate([report('en')], ['en']).ok, true)
    assert.equal(
        gate(
            CAPTURE_LOCALES.map((locale) => report(locale)),
            ['en']
        ).ok,
        true
    )
    assert.equal(gate([report('en')], ['en', 'pt-BR']).ok, false)
    assert.equal(gate([report('en')]).ok, false)
    assert.equal(gate(CAPTURE_LOCALES.map((locale) => report(locale))).ok, true)
    assert.equal(gate([report('en'), report('en')], ['en']).ok, false)
    for (const locales of [[], ['fr'], 'en']) assert.equal(gate([report('en')], locales).ok, false)
    const zero = gate([report('en', 0)], ['en'])
    assert.equal(zero.ok, false)
    assert.match(zero.reason, /\(en\) has zero visual differences/)
    assert.match(zero.reason, /screens:all-locales/)
})

test('locale-scoped integration runs are reusable baselines for the locales they captured', () => {
    const run = {
        path: '.github/workflows/screen-library.yml',
        event: 'push',
        head_branch: 'dev',
        head_sha: sha,
        head_repository: { full_name: repository },
        status: 'completed',
    }
    const jobs = [{ name: 'capture_after (en)', status: 'completed', conclusion: 'success' }]
    const artifacts = [{ name: 'screen-library-after-en-1', expired: false }]
    assert.equal(trustedIntegrationBaselineRun(run, jobs, repository, sha, ['en']), true)
    assert.equal(trustedIntegrationBaselineRun(run, jobs, repository, sha, ['en', 'es-419']), false)
    assert.equal(trustedIntegrationBaselineRun(run, jobs, repository, sha), false)
    assert.deepEqual(
        completeBaselineArtifacts(artifacts, 'integration', sha, ['en']).map((artifact) => artifact.name),
        ['screen-library-after-en-1']
    )
    assert.deepEqual(completeBaselineArtifacts(artifacts, 'integration', sha, ['es-419']), [])
    assert.deepEqual(completeBaselineArtifacts(artifacts, 'integration', sha), [])
    assert.deepEqual(completeBaselineArtifacts(artifacts, 'integration', sha, []), [])
})

function decide({ path, capabilities, event = 'pull_request', labels = [], prNumber = '42' }) {
    const directory = mkdtempSync(join(tmpdir(), 'screen-locales-'))
    try {
        writeFileSync(
            join(directory, 'git'),
            `#!/bin/sh\ncase "$1" in\n  diff) printf '%s\\0' '${path}' ;;\n  show) printf '%s' '${JSON.stringify(capabilities)}' ;;\n  *) exit 1 ;;\nesac\n`,
            { mode: 0o755 }
        )
        // A null label list stands for an unavailable GitHub API.
        writeFileSync(
            join(directory, 'gh'),
            labels === null
                ? '#!/bin/sh\nexit 1\n'
                : `#!/bin/sh\n[ "$2" = "repos/peanutprotocol/peanut-ui/pulls/${prNumber}" ] || exit 1\nprintf '%s' '${JSON.stringify(labels)}'\n`,
            { mode: 0o755 }
        )
        const output = join(directory, 'output')
        execFileSync(process.execPath, [new URL('./decide-capture.mjs', import.meta.url).pathname], {
            cwd: directory,
            encoding: 'utf8',
            timeout: 30000,
            env: {
                ...process.env,
                PATH: `${directory}:${process.env.PATH}`,
                BEFORE: 'b'.repeat(40),
                AFTER: 'c'.repeat(40),
                EVENT: event,
                BRANCH: 'dev',
                REPOSITORY: repository,
                PR_NUMBER: event === 'pull_request' ? prNumber : '',
                GITHUB_OUTPUT: output,
            },
        })
        const line = readFileSync(output, 'utf8')
            .split('\n')
            .find((entry) => entry.startsWith('locales='))
        return JSON.parse(line.slice('locales='.length))
    } finally {
        rmSync(directory, { recursive: true, force: true })
    }
}

test('the caller narrows locales from live PR labels once trusted dev advertises locale scope', () => {
    const scoped = { galleryMaintenance: 1, scopedCapture: 1, localeScope: 1 }
    assert.deepEqual(decide({ path: 'src/a.tsx', capabilities: scoped }), ['en'])
    assert.deepEqual(decide({ path: 'src/a.tsx', capabilities: scoped, event: 'push', labels: null }), ['en'])
    assert.deepEqual(
        decide({ path: 'src/a.tsx', capabilities: scoped, labels: ['bug', ALL_LOCALES_LABEL] }),
        CAPTURE_LOCALES
    )
    assert.deepEqual(decide({ path: 'src/a.tsx', capabilities: scoped, labels: null }), CAPTURE_LOCALES)
    assert.deepEqual(decide({ path: 'src/a.tsx', capabilities: scoped, prNumber: 'x' }), CAPTURE_LOCALES)
    assert.deepEqual(
        decide({ path: 'src/a.tsx', capabilities: { galleryMaintenance: 1, scopedCapture: 1 } }),
        CAPTURE_LOCALES
    )
})

test('caller skips drafts, cancels on conversion to draft and lets the planner read live labels', () => {
    const caller = readFileSync(new URL('../../.github/workflows/screen-library.yml', import.meta.url), 'utf8')
    assert.match(caller, /types: \[opened, synchronize, reopened, ready_for_review, converted_to_draft\]/)
    assert.match(caller, /!github\.event\.pull_request\.draft/)
    assert.doesNotMatch(caller, /labeled/)
    const refs = caller.slice(caller.indexOf('\n    refs:\n'), caller.indexOf('\n    capture_after:\n'))
    assert.match(refs, /permissions:\n\s+contents: read\n\s+pull-requests: read/)
    assert.match(refs, /PR_NUMBER: \$\{\{ github\.event\.pull_request\.number \}\}/)
    assert.match(refs, /locales: \$\{\{ steps\.plan\.outputs\.locales \}\}/)
    const capabilities = JSON.parse(readFileSync(new URL('./capture-capabilities.json', import.meta.url), 'utf8'))
    assert.equal(capabilities.localeScope, 1)
})
