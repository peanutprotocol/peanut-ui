const { execFileSync } = require('node:child_process')
const path = require('node:path')

const root = path.resolve(__dirname, '../..')
// The adapter suite takes ~17-19 s alone and longer inside the parallel CI unit
// run: at 30 s the child was killed mid-suite (ui#4081, 32 s). Each test's Jest
// limit (95 s) stays above the child's so a kill reports with its signal.
const CHILD_TIMEOUT_MS = 90000
const childOptions = { cwd: root, encoding: 'utf8', timeout: CHILD_TIMEOUT_MS }

// The shared-lock ui-unit.sh entry point runs Jest files. Keep the existing
// Node test suite executable through that required runner without converting it.
it('runs the existing synthetic screen adapter Node acceptance suite', () => {
    let output
    try {
        output = execFileSync(
            process.execPath,
            ['--test', '--test-reporter=tap', 'scripts/screens/adapter.test.mjs'],
            childOptions
        )
    } catch (error) {
        const killed = error.signal ? `killed by ${error.signal} after ${CHILD_TIMEOUT_MS} ms\n` : ''
        throw new Error(killed + String(error.stdout || error.stderr || error))
    }
    expect(output).toMatch(/^# tests [1-9]\d*$/m)
    expect(output).toMatch(/^# fail 0$/m)
}, 95000)

it('keeps paperwork refusals and QR identity restarts in synthetic captures without network access', () => {
    const fixtures = [
        'get-paid-usd-closed-bangladesh',
        'get-paid-usd-closed-bangladesh-claim',
        'qr-pay-identity-missing',
        'qr-pay-identity-restart-pending',
        'qr-pay-identity-document-missing',
    ]
    const output = execFileSync(
        process.execPath,
        [
            '--import',
            'tsx',
            '--input-type=module',
            '-e',
            `
let networkRequests = 0;
globalThis.fetch = () => { networkRequests++; throw new Error('Unexpected network request'); };
const { default: adapter } = await import('./scripts/screens/adapter.ts');
const values = [];
for (const fixture of ${JSON.stringify(fixtures)}) {
    const response = await adapter.answer(fixture, '/users/me', 'GET');
    values.push({ fixture, status: response.status, body: await response.json() });
}
console.log('RESULT:' + JSON.stringify({ values, networkRequests }));
`,
        ],
        childOptions
    )
    const result = JSON.parse(output.split('RESULT:')[1])
    expect(result.networkRequests).toBe(0)
    expect(result.values).toHaveLength(fixtures.length)
    for (const { fixture, status, body } of result.values) {
        expect(status).toBe(200)
        if (fixture.startsWith('get-paid-usd-closed-bangladesh')) {
            expect(body.capabilities.features.bank.accounts.USD).toMatchObject({ state: 'refused' })
        } else {
            expect(body.capabilities.features.qr).toMatchObject({
                state: 'action_required',
                action: 'restart-identity',
            })
            const qr = body.capabilities.rails.find((rail) => rail.id === 'manteca.pix_br')
            expect(qr.resolved).toMatchObject({
                status: 'fixable',
                blocking: { selfHealable: true, selfHealKind: 'restart-identity' },
                nextAction: { kind: 'restart-identity' },
            })
        }
    }
}, 95000)
