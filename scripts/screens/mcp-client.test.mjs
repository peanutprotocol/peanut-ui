import test from 'node:test'
import assert from 'node:assert/strict'
import { collectionRequest, textResult } from './mcp/client.mjs'

test('MCP client reaches the collection service only through its private binding', async () => {
    let request
    const result = await collectionRequest(
        {
            COLLECTION_SERVICE_TOKEN: 'secret',
            COLLECTIONS: {
                async fetch(value) {
                    request = value
                    return Response.json({ screens: [{ id: 'profile' }] })
                },
            },
        },
        '/v1/screens?q=profile'
    )
    assert.equal(new URL(request.url).hostname, 'screen-collections.internal')
    assert.equal(request.headers.get('authorization'), 'Bearer secret')
    assert.equal(result.screens[0].id, 'profile')
    assert.match(textResult(result).content[0].text, /profile/)
})
