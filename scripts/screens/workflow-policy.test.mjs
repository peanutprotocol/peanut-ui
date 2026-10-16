import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const screenLibrary = readFileSync('.github/workflows/screen-library.yml', 'utf8')
const testsWorkflow = readFileSync('.github/workflows/tests.yml', 'utf8')
const baseline = readFileSync('.github/workflows/screen-library-baseline.yml', 'utf8')
const publisher = readFileSync('.github/workflows/screen-library-publish.yml', 'utf8')
const gallery = readFileSync('.github/workflows/screen-library-gallery.yml', 'utf8')
const collections = readFileSync('.github/workflows/screen-library-collection.yml', 'utf8')
const publishRun = readFileSync('scripts/screens/publish-run.mjs', 'utf8')
const baselinePublisher = readFileSync('scripts/screens/publish-baseline-viewports.mjs', 'utf8')

test('main updates capture both full catalogues and retain the original push boundary in trusted publishing', () => {
    assert.match(screenLibrary, /push:\n\s+branches: \[dev, main\]/)
    assert.match(screenLibrary, /PUSH_BEFORE: \$\{\{ github\.event\.before \}\}/)
    assert.match(screenLibrary, /node scripts\/screens\/capture-revisions\.mjs >> "\$GITHUB_OUTPUT"/)
    assert.equal((screenLibrary.match(/'refs\/heads\/main' && '--full-catalogue'/g) ?? []).length, 2)
    assert.match(publisher, /PUSH_BEFORE: \$\{\{ github\.event\.before \}\}/)
    for (const field of ['before', 'after'])
        assert.match(
            publisher,
            new RegExp(`MAIN_${field.toUpperCase()}: \\$\\{\\{ github\\.event\\.inputs\\.${field}_sha \\}\\}`)
        )
    assert.match(publishRun, /before: run\.event === 'push' \? process\.env\.PUSH_BEFORE : process\.env\.MAIN_BEFORE/)
})

test('capture workflows run on the standard Ubuntu pool', () => {
    assert.equal((screenLibrary.match(/runs-on: ubuntu-24\.04/g) ?? []).length, 3)
    assert.doesNotMatch(screenLibrary, /runs-on: macos-/)
    assert.match(baseline, /runs-on: ubuntu-24\.04/)
    assert.doesNotMatch(baseline, /runs-on: macos-/)
    assert.equal((collections.match(/runs-on: ubuntu-24\.04/g) ?? []).length, 3)
    assert.doesNotMatch(collections, /runs-on: macos-/)
})

test('main-triggered baseline captures three extra viewports without renaming default artifacts', () => {
    assert.match(baseline, /branches: \[main\]/)
    assert.match(baseline, /git\/ref\/heads\/dev/)
    for (const profile of ['393x852', '440x956', '360x800', '320x712'])
        assert.match(baseline, new RegExp(`name: '${profile}'`))
    assert.match(baseline, /--profile=\$\{\{ matrix\.profile\.name \}\}/)
    assert.match(
        baseline,
        /screen-library-baseline-\$\{\{ needs\.revision\.outputs\.sha \}\}-\$\{\{ matrix\.locale \}\}\$\{\{ matrix\.profile\.artifact_suffix \}\}-\$\{\{ github\.run_attempt \}\}/
    )
    assert.match(baseline, /needs: \[revision, capture\]/)
    assert.match(baseline, /environment: screen-library-deploy/)
    assert.match(baseline, /node scripts\/screens\/publish-baseline-viewports\.mjs/)
})

test('only superseded pull-request captures are cancelled', () => {
    assert.match(screenLibrary, /github\.event_name == 'pull_request'/)
    assert.match(screenLibrary, /format\('pr-\{0\}', github\.event\.pull_request\.number\)/)
    assert.match(screenLibrary, /format\('run-\{0\}', github\.run_id\)/)
    assert.match(screenLibrary, /cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}/)
})

test('collection captures always finalize partial artifacts so missing states can be retried', () => {
    assert.match(collections, /if: \$\{\{ always\(\) && needs\.request\.result == 'success' \}\}/)
    assert.match(collections, /continue-on-error: true/)
    assert.match(collections, /mkdir -p incoming/)
})

test('publisher and deploy reuse one Cloudflare API token during the secret-name transition', () => {
    const declaredInputs = publisher.slice(0, publisher.indexOf('permissions:'))
    assert.match(screenLibrary, /CLOUDFLARE_PUBLISH_TOKEN: \$\{\{ secrets\.CLOUDFLARE_API_TOKEN \}\}/)
    assert.doesNotMatch(screenLibrary, /^\s+CLOUDFLARE_API_TOKEN:/m)
    assert.match(declaredInputs, /CLOUDFLARE_PUBLISH_TOKEN:\n\s+required: false/)
    assert.match(declaredInputs, /CLOUDFLARE_API_TOKEN:\n\s+required: false/)
    assert.match(gallery, /environment: screen-library-deploy/)
    assert.match(publisher, /uses: peanutprotocol\/peanut-ui\/\.github\/workflows\/screen-library-gallery.yml@dev/)
    assert.match(
        publisher,
        /CLOUDFLARE_PUBLISH_TOKEN: \$\{\{ secrets\.CLOUDFLARE_API_TOKEN \|\| secrets\.CLOUDFLARE_PUBLISH_TOKEN \}\}/
    )
    // Scope credentials to each operation, so adding a migration/deployment
    // cannot pass because an unrelated step happens to contain the fallback.
    const token =
        /CLOUDFLARE_API_TOKEN: \$\{\{ secrets\.CLOUDFLARE_API_TOKEN \|\| secrets\.CLOUDFLARE_PUBLISH_TOKEN \}\}/
    const stepsOf = (workflow) => workflow.split(/^ {12}- /m).slice(1)
    const operations = [
        [publisher, 'node scripts/screens/publish-run.mjs'],
        [publisher, 'node scripts/screens/rebuild-index.mjs'],
        [gallery, 'node scripts/screens/rebuild-index.mjs'],
        [gallery, 'wrangler d1 migrations apply COMMENTS --remote'],
        [gallery, 'wrangler deploy --config /tmp/screen-gallery/wrangler.json'],
        [gallery, 'wrangler deploy --config /tmp/screen-collections/wrangler.json'],
        [gallery, 'wrangler deploy --config /tmp/screen-library-mcp/wrangler.json'],
    ]
    for (const [workflow, operation] of operations) {
        const matching = stepsOf(workflow).filter((step) => step.includes(operation))
        assert.equal(matching.length, 1, `${operation} must have one explicit workflow step`)
        assert.match(matching[0], token, `${operation} must receive the token fallback`)
    }
    const steps = [...stepsOf(publisher), ...stepsOf(gallery)]
    for (const step of steps.filter((value) => /\bwrangler (?:deploy|d1 migrations apply)\b/.test(value)))
        assert.match(step, token, 'every remote deployment or migration must receive the token fallback')
    for (const declaration of steps.flatMap((value) => value.match(/^\s+CLOUDFLARE_API_TOKEN:[^\n]*/gm) ?? []))
        assert.match(declaration, token, 'every declared Cloudflare token must use the same fallback')
    assert.equal((publisher.match(new RegExp(token.source, 'g')) ?? []).length, 2)
    assert.match(gallery, /CLOUDFLARE_API_TOKEN is missing from the reusable screen-library publisher/)
})

test('immutable uploads run outside the short serialized index refresh', () => {
    assert.doesNotMatch(publisher, /group: screen-library-publisher/)
    assert.match(publisher, /group: screen-library-index/)
    assert.match(publisher, /node scripts\/screens\/rebuild-index\.mjs/)
    assert.match(baseline, /group: screen-library-index/)
    assert.match(baseline, /node scripts\/screens\/rebuild-index\.mjs/)
    assert.match(publishRun, /updateSharedIndexes: false/)
    assert.match(baselinePublisher, /updateSharedIndexes: false/)
})

test('screen tests use supported Node and install the isolated worker dependency before running', () => {
    const job = testsWorkflow.match(/^    screen-tests:\n[\s\S]*?(?=^    [A-Za-z0-9_-]+:\s*$|$(?![\s\S]))/m)?.[0]
    assert.ok(job, 'tests workflow must retain its screen-tests job')

    const nodeVersion = job.match(
        /actions\/setup-node@[^\n]*\n[ \t]+with:\n[ \t]+node-version:\s*["']?([^"'\s]+)["']?/m
    )?.[1]
    assert.ok(nodeVersion, 'screen-tests must declare its Node version')
    assert.match(
        nodeVersion,
        /^(?:22(?:\.x)?|22\.(?:1[3-9]|[2-9]\d)(?:\.\d+)?|(?:2[3-9]|[3-9]\d)(?:\.\d+)?|\d{3,}(?:\.\d+)?|>=22\.13(?:\.\d+)?)$/,
        'screen-tests must resolve to Node 22 latest or Node >=22.13'
    )

    const install = job.indexOf('npm ci --ignore-scripts')
    assert.notEqual(install, -1, 'screen-tests must install the locked deploy package without lifecycle scripts')
    const installStep = job.split(/(?=^[ \t]{12}- )/m).find((step) => step.includes('npm ci --ignore-scripts'))
    assert.ok(installStep, 'deploy dependency installation must be a workflow step')
    assert.match(
        installStep,
        /working-directory:\s*scripts\/screens\/deploy/,
        'npm ci must run in the isolated scripts/screens/deploy package'
    )

    const link = job.search(/^\s+run:\s+ln -s \.\.\/deploy\/node_modules scripts\/screens\/worker\/node_modules\s*$/m)
    assert.notEqual(
        link,
        -1,
        'the ESM worker must resolve the locked deploy dependencies through its node_modules link'
    )
    const testCommand = job.search(/^\s+run:\s+pnpm screens:test\s*$/m)
    assert.notEqual(testCommand, -1, 'the existing screens test command must remain unchanged')
    assert.ok(install < link && link < testCommand, 'install and worker link must precede pnpm screens:test')

    const appWorkflow = testsWorkflow.replace(job, '')
    const unchangedAppNodeVersions = [...appWorkflow.matchAll(/^\s+node-version:\s*["']?([^"'\s]+)["']?\s*$/gm)].map(
        (match) => match[1]
    )
    assert.ok(
        unchangedAppNodeVersions.length > 0 && unchangedAppNodeVersions.every((version) => version === '20'),
        'other application jobs must remain on their existing Node 20 runtime'
    )
})
