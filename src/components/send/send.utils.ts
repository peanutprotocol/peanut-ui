import { providers } from "ethers";
import { isMobile } from "react-device-detect";
import { WalletClient } from "wagmi";
import { getWalletClient } from "@wagmi/core";

export const textHandler = (text: string) => {
  if (isMobile) {
    if (text.length <= 4) {
      return "text-6xl";
    } else if (text.length > 21) {
      return "text-sm";
    } else if (text.length > 19) {
      return "text-md";
    } else if (text.length > 17) {
      return "text-lg";
    } else if (text.length > 12) {
      return "text-2xl";
    } else if (text.length > 8) {
      return "text-4xl";
    } else {
      return "text-5xl";
    }
  } else {
    if (text.length <= 4) {
      return "text-6xl";
    } else if (text.length > 17) {
      return "text-sm";
    } else if (text.length > 13) {
      return "text-md";
    } else if (text.length > 10) {
      return "text-lg";
    } else if (text.length > 7) {
      return "text-2xl";
    } else if (text.length > 5) {
      return "text-4xl";
    } else {
      return "text-5xl";
    }
  }
};

export function walletClientToSigner(walletClient: WalletClient) {
  const { account, chain, transport } = walletClient;
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  };
  const provider = new providers.Web3Provider(transport, network);
  const signer = provider.getSigner(account.address);
  return signer;
}
