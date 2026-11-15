import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

function run(script) {
    const output = execFileSync(
        process.execPath,
        [
            '--import',
            'tsx',
            '--input-type=module',
            '-e',
            `import rpc from './scripts/screens/rpc.ts'; const { answerRpc, isChainRpc, isRhinoTokenConfigs } = rpc;
             import { encodeFunctionData, decodeFunctionResult, erc20Abi, multicall3Abi, decodeAbiParameters } from 'viem';
             const owner = '0x000000000000000000000000000000000000dEaD';
             const balanceOf = encodeFunctionData({ abi: erc20Abi, functionName: 'balanceOf', args: [owner] });
             const decode = (hex) => decodeAbiParameters([{ type: 'uint256' }], hex)[0].toString();
             const ARB = 'https://arb1.arbitrum.io/rpc', ETH = 'https://ethereum.publicnode.com';
             const rpcCall = (url, fixture, calls) => { const a = answerRpc(url, fixture, JSON.stringify(calls)); return { ...a, body: JSON.parse(a.body) } };
             ${script}`,
        ],
        { encoding: 'utf8' }
    )
    return JSON.parse(output.split('RESULT:')[1])
}

const USDC = '0xaf88d065e77c8cc2239327c5edb3a432268e5831'
const MAINNET_USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'

test('the wallet balance read answers with the balance the fixture shows', () => {
    const result = run(`
        const read = (fixture) => rpcCall(ARB, fixture, { jsonrpc: '2.0', id: 7, method: 'eth_call', params: [{ to: '${USDC}', data: balanceOf }, 'latest'] }).body;
        const empty = read('home-new-user'), fallback = read('fixture-without-balance');
        console.log('RESULT:' + JSON.stringify({ empty: decode(empty.result), id: empty.id, fallback: decode(fallback.result) }));
    `)
    assert.deepEqual(result, { empty: '0', id: 7, fallback: '1250750000' })
})

test('batches answer every call in order and fallback health checks pass', () => {
    const result = run(`
        const answer = rpcCall(ARB, 'fixture-without-balance', [
            { jsonrpc: '2.0', id: 1, method: 'net_listening', params: [] },
            { jsonrpc: '2.0', id: 2, method: 'eth_call', params: [{ to: '${USDC.toUpperCase().replace('0X', '0x')}', data: balanceOf }, 'latest'] },
            { jsonrpc: '2.0', id: 3, method: 'eth_getBalance', params: [owner, 'latest'] },
            { jsonrpc: '2.0', id: 4, method: 'eth_getCode', params: [owner, 'latest'] },
        ]);
        console.log('RESULT:' + JSON.stringify({ body: answer.body.map((r) => [r.id, r.id === 2 ? decode(r.result) : r.result]), unmapped: answer.unmapped }));
    `)
    assert.deepEqual(result, {
        body: [
            [1, true],
            [2, '1250750000'],
            [3, '0x0'],
            [4, '0x'],
        ],
        unmapped: [],
    })
})

test('a multicall balance scan holds nothing beyond the wallet token on the wallet chain', () => {
    const result = run(`
        const aggregate = (tokens) => encodeFunctionData({ abi: multicall3Abi, functionName: 'aggregate3', args: [tokens.map((target) => ({ target, allowFailure: true, callData: balanceOf }))] });
        const scan = (url, tokens) => {
            const r = rpcCall(url, 'fixture-without-balance', { jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: '0xcA11bde05977b3631167028862bE2a173976CA11', data: aggregate(tokens) }, 'latest'] }).body.result;
            return decodeFunctionResult({ abi: multicall3Abi, functionName: 'aggregate3', data: r }).map((x) => [x.success, decode(x.returnData)]);
        };
        console.log('RESULT:' + JSON.stringify({ arbitrum: scan(ARB, ['${USDC}', '0x0000000000000000000000000000000000000002']), mainnet: scan(ETH, ['${MAINNET_USDC}', '${USDC}']) }));
    `)
    assert.deepEqual(result, {
        arbitrum: [
            [true, '1250750000'],
            [true, '0'],
        ],
        mainnet: [
            [true, '0'],
            [true, '0'],
        ],
    })
})

test('any other chain read is reported unmapped instead of guessed', () => {
    const result = run(`
        const kernelNonce = encodeFunctionData({ abi: [{ type: 'function', name: 'currentNonce', inputs: [], outputs: [{ type: 'uint32' }], stateMutability: 'view' }], functionName: 'currentNonce' });
        const other = rpcCall(ARB, 'home-new-user', [
            { jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: owner, data: kernelNonce }, 'latest'] },
            { jsonrpc: '2.0', id: 2, method: 'eth_estimateGas', params: [{ to: owner }] },
        ]);
        console.log('RESULT:' + JSON.stringify({ unmapped: other.unmapped, errors: other.body.map((r) => r.error?.code) }));
    `)
    assert.deepEqual(result, { unmapped: ['RPC eth_call 0xadb610a3', 'RPC eth_estimateGas'], errors: [-32601, -32601] })
})

test('only the app’s configured chain endpoints and the Rhino token list are answered', () => {
    const result = run(`
        console.log('RESULT:' + JSON.stringify([
            isChainRpc('https://arb1.arbitrum.io/rpc'),
            isChainRpc('https://arbitrum.publicnode.com/'),
            isChainRpc('https://mainnet.base.org'),
            isChainRpc('https://rpc.zerodev.app/api/v3/bundler/42161'),
            isChainRpc('https://staging.peanut.me/rpc'),
            isRhinoTokenConfigs('https://api.rhino.fi/bridge/bridge-swap-token-configs'),
            isRhinoTokenConfigs('https://api.rhino.fi/bridge/quote'),
        ]));
    `)
    assert.deepEqual(result, [true, true, true, false, false, true, false])
})
