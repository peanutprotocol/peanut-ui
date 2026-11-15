import { REQUIRED_API_CONTRACTS } from '@/constants/api-contracts.json'
import { API_CONTRACT_STATES } from '../api-contract-states'

it('keeps the compatible API ribbon surface aligned with every required contract', () => {
    expect(API_CONTRACT_STATES['api-ribbon-compatible'].api.version?.contracts).toEqual(REQUIRED_API_CONTRACTS)
})
