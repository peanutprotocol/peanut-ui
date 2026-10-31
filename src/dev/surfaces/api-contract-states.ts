import type { ApiCompatibility } from '@/utils/api-contracts'

const version = { commit: 'e7a93bf7d', branch: 'preview', builtAt: null, migrationsHead: null, contracts: { kyc: 3 } }

export const API_CONTRACT_STATES: Record<string, { name: string; api: ApiCompatibility }> = {
    'api-ribbon-loading': {
        name: 'Test build — API version loading',
        api: { status: 'loading', version: null, contractError: false },
    },
    'api-ribbon-compatible': {
        name: 'Test build — compatible API',
        api: { status: 'compatible', version, contractError: false },
    },
    'api-ribbon-too-old': {
        name: 'Test build — API too old',
        api: { status: 'incompatible', version: { ...version, contracts: { kyc: 2 } }, contractError: false },
    },
    'api-ribbon-missing-version': {
        name: 'Test build — version endpoint missing',
        api: {
            status: 'incompatible',
            version: { ...version, commit: null, contracts: { kyc: 0 } },
            contractError: false,
        },
    },
    'api-ribbon-unavailable': {
        name: 'Test build — API version unavailable',
        api: { status: 'unknown', version: null, contractError: false },
    },
    'api-ribbon-contract-error': {
        name: 'Test build — route contract error',
        api: { status: 'compatible', version, contractError: true },
    },
}
