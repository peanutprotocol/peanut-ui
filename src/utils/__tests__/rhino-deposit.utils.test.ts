import { decodeFunctionData, erc20Abi, parseAbi } from 'viem'
import { encodeRhinoDepositWithId, rhinoDepositWithIdCalls } from '../rhino-deposit.utils'

const TOKEN = '0xaf88d065e77c8cC2239327C5EDb3A432268e5831'
const BRIDGE = '0x10417734001162Ea139e8b044DFe28DbB8B28ad0'
const DEPOSIT_ABI = parseAbi(['function depositWithId(address tokenAddress, uint256 amount, uint256 commitmentId)'])

describe('rhino depositWithId calls', () => {
    it('encodes the commitment id as the hex number Rhino minted', () => {
        const data = encodeRhinoDepositWithId({ tokenAddress: TOKEN, amount: 20_020_325n, commitmentId: 'ff' })
        const decoded = decodeFunctionData({ abi: DEPOSIT_ABI, data })
        expect(decoded.functionName).toBe('depositWithId')
        expect(decoded.args).toEqual([TOKEN, 20_020_325n, 255n])
    })

    it('approves exactly the deposit amount to the bridge contract, then deposits', () => {
        const [approve, deposit] = rhinoDepositWithIdCalls({
            tokenAddress: TOKEN,
            contractAddress: BRIDGE,
            amount: 1_000_000n,
            commitmentId: '6aeb17ea29f84d1e9b0c3a5d7e2f1c08',
        })
        expect(approve.to).toBe(TOKEN)
        expect(decodeFunctionData({ abi: erc20Abi, data: approve.data }).args).toEqual([BRIDGE, 1_000_000n])
        expect(deposit.to).toBe(BRIDGE)
        expect(decodeFunctionData({ abi: DEPOSIT_ABI, data: deposit.data }).args).toEqual([
            TOKEN,
            1_000_000n,
            BigInt('0x6aeb17ea29f84d1e9b0c3a5d7e2f1c08'),
        ])
    })
})
