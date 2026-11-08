const { execFileSync } = require('node:child_process')
const path = require('node:path')

const root = path.resolve(__dirname, '../..')
const childOptions = { cwd: root, encoding: 'utf8', timeout: 30000 }

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
        throw new Error(String(error.stdout || error.stderr || error))
    }
    expect(output).toMatch(/^# tests [1-9]\d*$/m)
    expect(output).toMatch(/^# fail 0$/m)
}, 35000)

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
}, 35000)
