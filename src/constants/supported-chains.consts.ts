import type { Chain } from 'viem'
import {
    arbitrum,
    arbitrumSepolia,
    avalanche,
    base,
    baseSepolia,
    blast,
    bsc,
    celo,
    celoAlfajores,
    cyber,
    degen,
    gnosis,
    holesky,
    hyperEvm,
    ink,
    kaia,
    katana,
    linea,
    mainnet,
    manta,
    mantle,
    mode,
    moonbeam,
    optimism,
    plasma,
    polygon,
    scroll,
    scrollSepolia,
    sepolia,
    stable,
    taikoHekla,
    tempo,
    zkSync,
    zkSyncSepoliaTestnet,
} from 'viem/chains'

/*
 * viem chain objects for the chains Peanut supports, keyed by chain id.
 *
 * `import * as chains from 'viem/chains'` pulls viem's whole ~700-chain
 * registry (≈120 KB gz) into every bundle that touches the importing module,
 * including the marketing pages. This map names only the chains the app knows:
 * every EVM chain in `chain-details.json`, the EVM chains in `CHAIN_REGISTRY`
 * (Kaia) and the sandbox wallet chain (Arbitrum Sepolia). Milkomeda C1 (2001)
 * is in `chain-details.json` but not in viem, so it never resolved.
 *
 * A chain added to `chain-details.json` or `CHAIN_REGISTRY` must be added here;
 * `supported-chains.consts.test.ts` fails until it is.
 */
export const SUPPORTED_VIEM_CHAINS: readonly Chain[] = [
    mainnet,
    optimism,
    bsc,
    gnosis,
    polygon,
    manta,
    zkSyncSepoliaTestnet,
    zkSync,
    stable,
    hyperEvm,
    moonbeam,
    tempo,
    mantle,
    cyber,
    base,
    kaia,
    plasma,
    holesky,
    mode,
    arbitrum,
    celo,
    avalanche,
    celoAlfajores,
    ink,
    linea,
    blast,
    baseSepolia,
    taikoHekla,
    arbitrumSepolia,
    scrollSepolia,
    scroll,
    katana,
    sepolia,
    degen,
]

const SUPPORTED_VIEM_CHAINS_BY_ID: ReadonlyMap<number, Chain> = new Map(
    SUPPORTED_VIEM_CHAINS.map((chain) => [chain.id, chain])
)

/** The viem chain for a supported chain id, or undefined for any other id. */
export function getSupportedViemChain(chainId: number | string): Chain | undefined {
    return SUPPORTED_VIEM_CHAINS_BY_ID.get(Number(chainId))
}
