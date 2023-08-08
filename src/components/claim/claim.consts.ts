import * as views from "./views";

export type linkState = "CLAIM" | "NOT_FOUND" | "ALREADY_CLAIMED" | "LOADING";

export type ClaimScreens = "INITIAL" | "SUCCESS";

export interface IClaimScreenState {
  screen: ClaimScreens;
  idx: number;
}

export interface IClaimDetails {
  tokenAddress: string;
  amount: number;
  decimals: number;
  chainId: number;
}

export interface IClaimScreenProps {
  onNextScreen: () => void;
  onCustomScreen: (screen: ClaimScreens) => void;
  claimLink: string;
  setClaimLink: (claimLink: string) => void;
  claimDetails: IClaimDetails;
  txHash: string;
  setTxHash: (txHash: string) => void;
}

export const INIT_VIEW: IClaimScreenState = {
  screen: "INITIAL",
  idx: 0,
};

export const CLAIM_SCREEN_FLOW: ClaimScreens[] = ["INITIAL", "SUCCESS"];

export const CLAIM_SCREEN_MAP: {
  [key in ClaimScreens]: { comp: React.FC<any> };
} = {
  INITIAL: { comp: views.ClaimView },
  SUCCESS: { comp: views.ClaimSuccessView },
};
