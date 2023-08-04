"use client";
import { atom, useSetAtom } from "jotai";
import { useAccount } from "wagmi";
import { useEffect } from "react";
const peanut = require("@squirrel-labs/peanut-sdk");

import { JsonRpcProvider, ethers } from "ethers";

import * as interfaces from "@/interfaces";
import * as socketTech from "@socket.tech/socket-v2-sdk";

export const userBalancesAtom = atom<interfaces.IUserBalance[]>([]);

export const defaultChainDetailsAtom = atom<any>({});
//Todo: make interface for chain details

export function Store({ children }: { children: React.ReactNode }) {
  const provider = new ethers.JsonRpcProvider(
    process.env.INFURA_GOERLI_PROVIDER_URL ?? ""
  );

  const setUserBalances = useSetAtom(userBalancesAtom);
  const setDefaultChainDetails = useSetAtom(defaultChainDetailsAtom);

  const { address, isDisconnected } = useAccount();

  useEffect(() => {
    setUserBalances([]);
    if (address) {
      //This will fetch all balances for the supported chains by socket.tech (https://docs.socket.tech/socket-liquidity-layer/socketll-overview/chains-dexs-bridges)
      loadUserBalances(address);
      loadUserBalancesGoerli(provider, address ?? "");

      //This will fetch all balances for the goerli testnet
    }
  }, [address]);

  useEffect(() => {
    if (isDisconnected) {
      setUserBalances([]);
    }
  }, [isDisconnected]);

  useEffect(() => {
    fetchChainDetails();
  }, [peanut]);

  const fetchChainDetails = async () => {
    if (peanut) {
      setDefaultChainDetails(peanut.default.CHAIN_DETAILS);
    }
  };

  const loadUserBalancesGoerli = async (
    provider: JsonRpcProvider,
    address: string
  ) => {
    try {
      const balance = await provider?.getBalance(address);
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
