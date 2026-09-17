import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
test('strict synthetic transport answers shared config and legacy rates without live requests', () => {
    const output = execFileSync(
        process.execPath,
        [
            '--import',
            'tsx',
            '--input-type=module',
            '-e',
            `
 import adapter from './scripts/screens/adapter.ts'; const {answer}=adapter;
 globalThis.fetch=()=>{throw new Error('Unexpected network request')};
 const values=[];
 for(const path of ['/users/me','/config/residence-restrictions','/tokens/price?chainId=42161&address=synthetic','/bridge/onramp/quote?accountType=iban','/qr/synthetic-invalid']) {
 const r=await answer('home',path,'GET'); values.push({status:r.status,body:await r.json()});
 }
 let rejected=false;try{await answer('home','/not-a-fixture','GET')}catch{rejected=true};
 console.log('RESULT:'+JSON.stringify({values,rejected}));
 `,
        ],
        { encoding: 'utf8' }
    )
    const result = JSON.parse(output.split('RESULT:')[1])
    assert.ok(result.rejected)
    assert.ok(result.values.every((r) => r.status === 200))
    assert.equal(result.values[0].body.user.activationCelebratedAt, '2026-01-01T00:00:00Z')
    assert.ok(Array.isArray(result.values[1].body.full))
    assert.equal(result.values[2].body.price, 1)
    assert.equal(result.values[3].body.from, 'EUR')
    assert.equal(result.values[4].body.available, false)
})
