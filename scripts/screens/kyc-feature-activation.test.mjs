import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

test('activation fixture reports and conflicts stay synthetic and unknown routes stay strict', () => {
    const output = execFileSync(
        process.execPath,
        [
            '--import',
            'tsx',
            '--input-type=module',
            '-e',
            `
        import adapter from './scripts/screens/adapter.ts';
        globalThis.fetch = () => { throw new Error('Live network forbidden') };
        const values = [];
        for (const feature of ['bank', 'local', 'card']) {
            for (const state of ['ready', 'on', 'setting_up', 'pending', 'action_required', 'refused', 'failed', 'questions_missing']) {
                const fixture = 'feature-activation-' + feature + '-' + state.replaceAll('_', '-');
                const response = await adapter.answer(fixture, '/users/kyc/features/' + feature + '/activate', 'POST');
                values.push({feature, state, status: response.status, body: await response.json()});
            }
        }
        for (const [path, method] of [['/users/kyc/features/evil/activate', 'POST'], ['/users/kyc/features/bank/activate', 'GET'], ['/unexpected', 'POST']]) {
            try { await adapter.answer('feature-activation-bank-on', path, method); values.push({unexpected: true}); }
            catch (error) { values.push({strict: String(error).includes('Unmapped capture API')}); }
        }
        console.log('RESULT:' + JSON.stringify(values));
    `,
        ],
        { encoding: 'utf8', timeout: 30000 }
    )
    const values = JSON.parse(output.split('RESULT:')[1])
    assert.equal(values.length, 27)
    for (const value of values.slice(0, 24)) {
        assert.equal(value.status, value.state === 'failed' ? 500 : value.state === 'questions_missing' ? 409 : 200)
        if (value.status === 200) assert.equal(value.body.state, value.state)
        if (value.status === 409) assert.equal(value.body.code, 'questions_missing')
    }
    assert.deepEqual(values.slice(24), [{ strict: true }, { strict: true }, { strict: true }])
})
