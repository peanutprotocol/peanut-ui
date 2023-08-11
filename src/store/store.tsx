"use client";
import { atom, useSetAtom } from "jotai";
import { useAccount } from "wagmi";
import { useEffect } from "react";
const peanut = require("@squirrel-labs/peanut-sdk");
import * as interfaces from "@/interfaces";
import * as socketTech from "@socket.tech/socket-v2-sdk";

export const userBalancesAtom = atom<interfaces.IUserBalance[]>([]);

export const defaultChainDetailsAtom = atom<interfaces.IPeanutChainDetails[]>(
  []
);
export const defaultTokenDetailsAtom = atom<interfaces.IPeanutTokenDetail[]>(
  []
);

export const supportedChainsSocketTechAtom = atom<
  socketTech.ChainDetails[] | undefined
>(undefined);

export function Store({ children }: { children: React.ReactNode }) {
  const setUserBalances = useSetAtom(userBalancesAtom);
  const setDefaultChainDetails = useSetAtom(defaultChainDetailsAtom);
  const setDefaultTokenDetails = useSetAtom(defaultTokenDetailsAtom);
  const setSupportedChainsSocketTech = useSetAtom(
    supportedChainsSocketTechAtom
  );

  const { address, isDisconnected } = useAccount();

  useEffect(() => {
    setUserBalances([]);
    if (address) {
      //This will fetch all balances for the supported chains by socket.tech (https://docs.socket.tech/socket-liquidity-layer/socketll-overview/chains-dexs-bridges)
      loadUserBalances(address);
    }
  }, [address]);

  useEffect(() => {
    if (isDisconnected) {
      setUserBalances([]);
    }
  }, [isDisconnected]);

  useEffect(() => {
    getSupportedChainsSocketTech();
    getPeanutChainAndTokenDetails();
  }, []);

  const getSupportedChainsSocketTech = async () => {
    try {
      const supportedChainsResponse =
        await socketTech.Supported.getAllSupportedChains();
      if (supportedChainsResponse.success) {
        setSupportedChainsSocketTech(supportedChainsResponse.result);
      }
    } catch (error) {
      console.error("error loading supportedChainsSocketTech, ", error);
    }
  };

  const getPeanutChainAndTokenDetails = async () => {
    if (peanut) {
      const chainDetailsArray = Object.keys(peanut.default.CHAIN_DETAILS).map(
        (key) => peanut.default.CHAIN_DETAILS[key]
      );
      const tokenDetailsArray = peanut.default.TOKEN_DETAILS;
      setDefaultChainDetails(chainDetailsArray);
      setDefaultTokenDetails(tokenDetailsArray);
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
