import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const FIXTURES = ['setup-signup-reserved', 'setup-passkey-username-taken', 'profile-accounts-card-state-blocked']
const COPY_KEYS = [
    'profile.unlockPayments.cardNotAvailableStateNote',
    'setup.passkey.usernameTaken',
    'setup.signupStep.errors.reserved',
]

function probe(fixture, requests) {
    const output = execFileSync(
        process.execPath,
        [
            '--import',
            'tsx',
            '--input-type=module',
            '-e',
            `
 import adapter from './scripts/screens/adapter.ts'; const {answer}=adapter;
 let networkRequests=0;
 globalThis.fetch=()=>{networkRequests++;throw new Error('Unexpected network request')};
 const values=[];
 for(const [path,method,body] of ${JSON.stringify(requests)}) {
 try {
 const response=await answer(${JSON.stringify(fixture)},path,method,body);
 values.push(method==='HEAD' ? {status:response.status} : {status:response.status,body:await response.json()});
 } catch(error) { values.push({error:String(error)}); }
 }
 console.log('RESULT:'+JSON.stringify({values,networkRequests}));
 `,
        ],
        { encoding: 'utf8', timeout: 30000 }
    )
    return JSON.parse(output.split('RESULT:')[1])
}

function probeCatalogue() {
    const output = execFileSync(
        process.execPath,
        [
            '--import',
            'tsx',
            '-e',
            "const { SCREENS } = require('./src/dev/screens/catalogue.ts'); console.log('RESULT:'+JSON.stringify(SCREENS))",
        ],
        { encoding: 'utf8', timeout: 30000 }
    )
    return JSON.parse(output.split('RESULT:')[1])
}

test('reserved signup answers are deterministic and distinguish reserved from taken', () => {
    const result = probe('setup-signup-reserved', [
        ['/users/username/kimchi', 'HEAD'],
        ['/users/username/reservations', 'POST', JSON.stringify({ username: 'kimchi' })],
        ['/users/username/kimchi', 'HEAD'],
        ['/users/username/reservations', 'POST', JSON.stringify({ username: 'kimchi' })],
    ])

    assert.equal(result.networkRequests, 0)
    assert.deepEqual(result.values, [
        { status: 404 },
        { status: 400, body: { code: 'USERNAME_RESERVED' } },
        { status: 404 },
        { status: 400, body: { code: 'USERNAME_RESERVED' } },
    ])
})

test('taken passkey username preserves successful reservation and reports availability on repeat probes', () => {
    const result = probe('setup-passkey-username-taken', [
        ['/users/username/reservations', 'POST', JSON.stringify({ username: 'kimchi' })],
        ['/users/username/kimchi', 'HEAD'],
        ['/users/username/kimchi', 'HEAD'],
    ])

    assert.equal(result.networkRequests, 0)
    assert.equal(result.values[0].status, 200, 'initial reservation remains successful')
    assert.deepEqual(result.values.slice(1), [{ status: 200 }, { status: 200 }])
})

test('the default setup passkey fixture still permits username reservation', () => {
    const result = probe('setup-passkey', [
        ['/users/username/reservations', 'POST', JSON.stringify({ username: 'kimchi' })],
    ])

    assert.equal(result.networkRequests, 0)
    assert.equal(result.values[0].status, 200)
})

test('blocked card fixture supplies a declared and verified US residence plus a specific geo block', () => {
    const result = probe('profile-accounts-card-state-blocked', [
        ['/users/me', 'GET'],
        ['/users/me/verified-address', 'GET'],
        ['/users/me', 'GET'],
        ['/users/me/verified-address', 'GET'],
    ])

    assert.equal(result.networkRequests, 0)
    assert.deepEqual(result.values[0], result.values[2], 'repeated profile reads are deterministic')
    assert.deepEqual(result.values[1], result.values[3], 'repeated verified-address reads are deterministic')
    assert.equal(result.values[0].status, 200)
    assert.equal(result.values[1].status, 200)
    const profile = result.values[0].body
    const residenceCountry = profile.residence?.declared?.country
    const verifiedResidenceCountry = profile.residence?.verified?.country
    assert.ok(['US', 'USA'].includes(residenceCountry), 'declared residence is US or USA')
    assert.ok(['US', 'USA'].includes(verifiedResidenceCountry), 'verified residence is US or USA')

    const card = profile.capabilities?.features?.card
    assert.ok(card, 'profile declares the card capability')
    assert.equal(card.state, 'refused')
    assert.equal(card.reason, 'geo-blocked')
    assert.equal(result.values[1].body.countryCode, residenceCountry)
    assert.equal(result.values[1].body.countryCode, 'US')
    assert.equal(result.values[1].body.subdivisionCode, 'NY')
})

test('copy fixtures are registered as visible catalogue checkpoints', () => {
    const screens = probeCatalogue()
    for (const fixture of FIXTURES) {
        const checkpoints = screens.filter((screen) => screen.fixture === fixture)
        assert.ok(checkpoints.length > 0, `${fixture} has a catalogue checkpoint`)
        assert.ok(
            checkpoints.every((screen) => !screen.exclusion?.trim() && !screen.unavailable?.trim()),
            `${fixture} checkpoints are not marked excluded or unavailable`
        )
        if (fixture !== 'profile-accounts-card-state-blocked') {
            assert.ok(
                checkpoints.some((screen) => screen.actions?.length > 0 && screen.expectSelector),
                `${fixture} has an actionable checkpoint with a visibility selector`
            )
        }
        if (fixture === 'profile-accounts-card-state-blocked') {
            assert.ok(
                checkpoints.some((screen) => /\[role="dialog"\]/.test(screen.expectSelector)),
                `${fixture} has a visible drawer checkpoint`
            )
        }
    }
})

test('copy state keys remain outside the established copy coverage baseline', () => {
    const baseline = JSON.parse(readFileSync(new URL('./copy-coverage-baseline.json', import.meta.url), 'utf8'))
    assert.equal(baseline.schema, 1)
    for (const key of COPY_KEYS) assert.equal(Object.hasOwn(baseline.keys, key), false, key)
})
