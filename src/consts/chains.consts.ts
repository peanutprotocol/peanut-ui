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
  },
  {
    name: "Goerli",
    chainId: 5,
  },
  {
    name: "Binance Smart Chain",
    chainId: 56,
  },
  {
    name: "Polygon",
    chainId: 137,
  },
  {
    name: "Optimism",
    chainId: 10,
  },
  {
    name: "Arbitrum",
    chainId: 42161,
  },
  {
    name: "Gnosis",
    chainId: 100,
  },
  {
    //not via socket.tech
    name: "Scroll",
    chainId: 534353,
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
