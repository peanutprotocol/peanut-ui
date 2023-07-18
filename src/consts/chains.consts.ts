export interface IChain {
  name: string;
  chainId: number;
}

export const CHAIN_MAP = [
  {
    name: "Ethereum",
    chainId: 1,
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
  //   534352: {
  //     name: "Scroll",
  //     chainId: 534352,
  //   },
  //Add filecoin and eth testnet (dont know which one)
];
