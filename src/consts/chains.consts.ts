import {
  gnosis,
  mainnet,
  arbitrum,
  polygon,
  bsc,
  goerli,
  scrollTestnet,
  optimism,
  bscTestnet,
  optimismGoerli,
  polygonZkEvmTestnet,
  mantleTestnet,
  gnosisChiado,
  avalancheFuji,
  avalanche,
  celoAlfajores,
  polygonMumbai,
  filecoinCalibration,
  neonDevnet,
} from "@wagmi/chains";

//rinkeby, lukso, zetachain not supported by wagmi
// goerli, scroll, bsctestnet, optigoerli, polygonzkevmtstnet, mantletestnet, gnosisChiado, avalancheFuji, celoalfajores, polygonmumbai, filecoincalibration and neondevnet are not supported by socket.tech

// avalancheFuji, bsctestnet, celo-alfajores, goerli, polygon mumbai,

export const chains = [
  mainnet,
  arbitrum,
  polygon,
  bsc,
  goerli,
  gnosis,
  scrollTestnet,
  optimism,
  bscTestnet,
  optimismGoerli,
  polygonZkEvmTestnet,
  mantleTestnet,
  gnosisChiado,
  avalancheFuji,
  avalanche,
  celoAlfajores,
  polygonMumbai,
  filecoinCalibration,
  neonDevnet,
];
