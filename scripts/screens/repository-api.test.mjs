import test from 'node:test'
import assert from 'node:assert/strict'
import { repositoryApiPath } from './repository-api.mjs'

test('builds the repository root API path without a trailing slash', () => {
    assert.equal(repositoryApiPath('peanutprotocol/peanut-ui'), 'repos/peanutprotocol/peanut-ui')
})

test('appends nested repository API paths', () => {
    assert.equal(
        repositoryApiPath('peanutprotocol/peanut-ui', 'actions/runs/123'),
        'repos/peanutprotocol/peanut-ui/actions/runs/123'
    )
})
