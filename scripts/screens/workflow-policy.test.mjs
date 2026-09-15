import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const screenLibrary = readFileSync('.github/workflows/screen-library.yml', 'utf8')
const baseline = readFileSync('.github/workflows/screen-library-baseline.yml', 'utf8')
const publisher = readFileSync('.github/workflows/screen-library-publish.yml', 'utf8')

test('capture workflows run on the standard Ubuntu pool', () => {
    assert.equal((screenLibrary.match(/runs-on: ubuntu-24\.04/g) ?? []).length, 3)
    assert.doesNotMatch(screenLibrary, /runs-on: macos-/)
    assert.match(baseline, /runs-on: ubuntu-24\.04/)
    assert.doesNotMatch(baseline, /runs-on: macos-/)
})

test('only superseded pull-request captures are cancelled', () => {
    assert.match(screenLibrary, /github\.event_name == 'pull_request'/)
    assert.match(screenLibrary, /format\('pr-\{0\}', github\.event\.pull_request\.number\)/)
    assert.match(screenLibrary, /format\('run-\{0\}', github\.run_id\)/)
    assert.match(screenLibrary, /cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}/)
})

test('publisher and deploy reuse one declared Cloudflare API token', () => {
    const declaredInputs = publisher.slice(0, publisher.indexOf('permissions:'))
    assert.match(screenLibrary, /CLOUDFLARE_API_TOKEN: \$\{\{ secrets\.CLOUDFLARE_API_TOKEN \}\}/)
    assert.doesNotMatch(screenLibrary, /CLOUDFLARE_PUBLISH_TOKEN/)
    assert.match(declaredInputs, /CLOUDFLARE_API_TOKEN:\n\s+required: true/)
    assert.doesNotMatch(publisher, /CLOUDFLARE_PUBLISH_TOKEN/)
    assert.match(publisher, /environment: screen-library-deploy/)
    assert.equal((publisher.match(/CLOUDFLARE_API_TOKEN: \$\{\{ secrets\.CLOUDFLARE_API_TOKEN \}\}/g) ?? []).length, 2)
    assert.match(publisher, /CLOUDFLARE_API_TOKEN is missing from the reusable screen-library publisher/)
})
