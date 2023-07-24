"use client";
import { atom, useSetAtom } from "jotai";
import { useAccount } from "wagmi";
import { useEffect } from "react";

import * as interfaces from "@/interfaces";
import * as socketTech from "@socket.tech/socket-v2-sdk";

export const userBalancesAtom = atom<interfaces.IUserBalance[]>([]);

export function Store({ children }: { children: React.ReactNode }) {
  const setUserBalances = useSetAtom(userBalancesAtom);

  const { address, isDisconnected } = useAccount();

  useEffect(() => {
    if (address) {
      loadUserBalances(address);
    }
  }, [address]);

  useEffect(() => {
    if (isDisconnected) {
      setUserBalances([]);
    }
  }, [isDisconnected]);

  const loadUserBalances = async (address: string) => {
    try {
      const userBalancesResponse = await socketTech.Balances.getBalances({
        userAddress: address,
      });

      if (userBalancesResponse.success) {
        setUserBalances(userBalancesResponse.result);
      } else {
        setUserBalances([]);
      }
    } catch (error) {
      console.log("error loading userBalances, ", error);
    }
  };

  return <>{children}</>;
}
