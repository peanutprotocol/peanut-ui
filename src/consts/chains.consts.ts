import {
  gnosis,
  mainnet,
  arbitrum,
  polygon,
  bsc,
  goerli,
  scrollTestnet,
} from "@wagmi/chains";

export interface IChain {
  name: string;
  chainId: number;
}

/* 

*/
export const CHAIN_MAP = [
  {
    name: "Ethereum",
    chainId: 1,
    explorerUrl: "https://etherscan.io",
  },
  {
    name: "Goerli",
    chainId: 5,
    explorerUrl: "https://goerli.etherscan.io",
  },
  {
    name: "Binance Smart Chain",
    chainId: 56,
    explorerUrl: "https://bscscan.com",
  },
  {
    name: "Polygon",
    chainId: 137,
    explorerUrl: "https://polygonscan.com",
  },
  {
    name: "Optimism",
    chainId: 10,
    explorerUrl: "https://optimistic.etherscan.io",
  },
  {
    name: "Arbitrum",
    chainId: 42161,
    explorerUrl: "https://arbiscan.io",
  },
  {
    name: "Gnosis",
    chainId: 100,
    explorerUrl: "https://gnosisscan.io",
  },
  {
    //not via socket.tech
    name: "Scroll",
    chainId: 534353,
    explorerUrl: "https://blockscout.scroll.io/",
  },
  //Add filecoin
];

export const chains = [
  mainnet,
  arbitrum,
  polygon,
  bsc,
  goerli,
  gnosis,
  scrollTestnet,
];
