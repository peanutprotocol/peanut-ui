import test from 'node:test'
import assert from 'node:assert/strict'
import { constantTimeEqual, verifiedAccessIdentity } from './access.mjs'

test('Access identity requires the expected audience and an allowed email', async () => {
    const context = {
        access: {
            aud: 'screen-library-access',
            getIdentity: async () => ({ email: 'REVIEWER@PEANUT.ME' }),
        },
    }
    assert.equal(await verifiedAccessIdentity(context, 'screen-library-access'), 'reviewer@peanut.me')
    assert.equal(await verifiedAccessIdentity(context, 'other-audience'), null)
    assert.equal(await verifiedAccessIdentity(undefined, 'screen-library-access'), null)
    assert.equal(
        await verifiedAccessIdentity(
            {
                access: {
                    aud: 'screen-library-access',
                    getIdentity: async () => ({ email: 'forged@example.com' }),
                },
            },
            'screen-library-access'
        ),
        null
    )
})

test('service-token comparison accepts only an exact value', async () => {
    assert.equal(await constantTimeEqual('Bearer secret', 'Bearer secret'), true)
    assert.equal(await constantTimeEqual('Bearer secret', 'Bearer secrex'), false)
    assert.equal(await constantTimeEqual('Bearer secret', 'Bearer secret-extra'), false)
})
