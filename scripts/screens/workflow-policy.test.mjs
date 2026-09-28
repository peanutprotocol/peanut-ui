import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const screenLibrary = readFileSync('.github/workflows/screen-library.yml', 'utf8')
const baseline = readFileSync('.github/workflows/screen-library-baseline.yml', 'utf8')
const publisher = readFileSync('.github/workflows/screen-library-publish.yml', 'utf8')
const collections = readFileSync('.github/workflows/screen-library-collection.yml', 'utf8')
const publishRun = readFileSync('scripts/screens/publish-run.mjs', 'utf8')
const baselinePublisher = readFileSync('scripts/screens/publish-baseline-viewports.mjs', 'utf8')

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
    assert.match(publisher, /environment: screen-library-deploy/)
    assert.equal(
        (
            publisher.match(
                /CLOUDFLARE_API_TOKEN: \$\{\{ secrets\.CLOUDFLARE_API_TOKEN \|\| secrets\.CLOUDFLARE_PUBLISH_TOKEN \}\}/g
            ) ?? []
        ).length,
        5
    )
    assert.match(publisher, /CLOUDFLARE_API_TOKEN is missing from the reusable screen-library publisher/)
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
