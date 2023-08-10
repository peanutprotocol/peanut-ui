export interface IUserBalance {
  chainId: number;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  price: number;
  amount: number;
  currency: string;
}

export interface IPeanutChainDetails {
  name: string;
  chain: string;
  icon: {
    url: string;
    width: number;
    height: number;
    format: string;
  }[];
  rpc: string[];
  features: {
    name: string;
  }[];
  faucets: string[];
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  infoURL: string;
  shortName: string;
  chainId: number;
  networkId: number;
  slip44: number;
  ens: {
    registry: string;
  };
  explorers: {
    name: string;
    url: string;
    standard: string;
  }[];
}

export interface IPeanutTokenDetail {
  chainId: string;
  name: string;
  tokens: {
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    logoURI: string;
  }[];
}

export interface ILocalStorageItem {
  address: string;
  hash: string;
  link: string;
}

export interface ILinkDetails {
  link: string;
  chainId: number;
  depositIndex: number;
  contractVersion: string;
  password: string;
  tokenType: number;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  tokenAmount: string;
}
