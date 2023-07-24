"use client";
import { atom, useSetAtom } from "jotai";
import { WalletClient, useAccount, useWalletClient } from "wagmi";
import { useEffect, useMemo } from "react";

import { BrowserProvider, ethers } from "ethers";

import * as interfaces from "@/interfaces";
import * as socketTech from "@socket.tech/socket-v2-sdk";

export const userBalancesAtom = atom<interfaces.IUserBalance[]>([]);

export function walletClientToSigner(walletClient: WalletClient) {
  const { account, chain, transport } = walletClient;
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  };
  const provider = new BrowserProvider(transport, network);
  return provider;
}

/** Hook to convert a viem Wallet Client to an ethers.js Signer. */
export function useEthersSigner({ chainId }: { chainId?: number } = {}) {
  const { data: walletClient } = useWalletClient({ chainId });
  return useMemo(
    () => (walletClient ? walletClientToSigner(walletClient) : undefined),
    [walletClient]
  );
}

export function Store({ children }: { children: React.ReactNode }) {
  const provider = useEthersSigner({ chainId: 5 });

  const setUserBalances = useSetAtom(userBalancesAtom);

  const { address, isDisconnected } = useAccount();

  useEffect(() => {
    if (address) {
      //This will fetch all balances for the supported chains by socket.tech (https://docs.socket.tech/socket-liquidity-layer/socketll-overview/chains-dexs-bridges)
      loadUserBalances(address);
      //This will fetch all balances for the goerli testnet
    }
  }, [address]);

  useEffect(() => {
    if (isDisconnected) {
      setUserBalances([]);
    }
  }, [isDisconnected]);

  useEffect(() => {
    if (provider && address) {
      //This will fetch all balances for the goerli testnet but make sure the provider is set
      loadUserBalancesGoerli(provider, address ?? "");
    }
  }, [provider]);

  const loadUserBalancesGoerli = async (
    provider: BrowserProvider,
    address: string
  ) => {
    try {
      const balance = await provider?.getBalance(address);
      console.log("balance: ", balance);
      const xx: interfaces.IUserBalance = {
        chainId: 5,
        symbol: "GoerliETH",
        name: "GoerliETH",
        address: "0xdD69DB25F6D620A7baD3023c5d32761D353D3De9",
        decimals: 18,
        amount: Number(ethers.formatEther(balance)),
        price: 0,
        currency: "GoerliETH",
      };
      if (balance > 0) {
        setUserBalances((prev) => {
          return [...prev, xx];
        });
      }
    } catch (error) {
      console.error("error loading userBalances, ", error);
    }
  };

  const loadUserBalances = async (address: string) => {
    try {
      const userBalancesResponse = await socketTech.Balances.getBalances({
        userAddress: address,
      });

      console.log("userBalancesResponse: ", userBalancesResponse);

      if (userBalancesResponse.success) {
        setUserBalances((prev) => {
          return [...prev, ...userBalancesResponse.result];
        });
      } else {
        setUserBalances([]);
      }
    } catch (error) {
      console.error("error loading userBalances, ", error);
    }
  };

  return <>{children}</>;
}
