"use client";
import { atom, useAtom, useSetAtom } from "jotai";
import { useAccount } from "wagmi";
import { useEffect } from "react";
const peanut = require("@squirrel-labs/peanut-sdk");

import { JsonRpcProvider, ethers } from "ethers";

import * as interfaces from "@/interfaces";
import * as socketTech from "@socket.tech/socket-v2-sdk";
import axios from "axios";

export const userBalancesAtom = atom<interfaces.IUserBalance[]>([]);

export const defaultChainDetailsAtom = atom<interfaces.IPeanutChainDetails[]>(
  []
);

export const supportedChainsSocketTechAtom = atom<
  socketTech.ChainDetails[] | undefined
>(undefined);

export function Store({ children }: { children: React.ReactNode }) {
  const provider = new ethers.JsonRpcProvider(
    process.env.INFURA_GOERLI_PROVIDER_URL ?? ""
  );

  const setUserBalances = useSetAtom(userBalancesAtom);
  const [x, setDefaultChainDetails] = useAtom(defaultChainDetailsAtom);
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
    getPeanutChainDetails();
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

  const getPeanutChainDetails = async () => {
    if (peanut) {
      console.log(peanut.default.CHAIN_DETAILS);
      //simple filter to remove the chains that arent supported by wagmi
      const chainsToExclude = [4, 42, 7001];
      const chainDetailsArray = Object.keys(peanut.default.CHAIN_DETAILS).map(
        (key) => peanut.default.CHAIN_DETAILS[key]
      );
      const filteredChainDetailsArray = chainDetailsArray.filter(
        (chain) => !chainsToExclude.includes(chain.chainId)
      );

      setDefaultChainDetails(filteredChainDetailsArray);
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
