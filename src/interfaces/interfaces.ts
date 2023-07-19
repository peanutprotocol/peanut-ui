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
