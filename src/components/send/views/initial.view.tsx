import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import { useWeb3Modal } from "@web3modal/react";
import { useAtom } from "jotai";
import toast from "react-hot-toast";
import { useAccount, useWalletClient, WalletClient } from "wagmi";
import { BrowserProvider, JsonRpcSigner } from "ethers";

import { useForm } from "react-hook-form";
import axios from "axios";

const peanut = require("@squirrel-labs/peanut-sdk");

import * as store from "@/store";
import * as consts from "@/consts";
import * as _consts from "../send.consts";

import peanutman_presenting from "@/assets/peanutman-presenting.svg";

const COINGECKO_API_BASE_URL = "https://api.coingecko.com/api/v3";

interface ISendFormData {
  chainId: number;
  token: string;
  amount: number;
}

export function SendInitialView({
  onNextScreen,
  setClaimLink,
  setTxReceipt,
}: _consts.ISendScreenProps) {
  const [denomination, setDenomination] = useState("USD");
  const { open } = useWeb3Modal();
  const { isConnected } = useAccount();
  const { address } = useAccount();

  const [userBalances] = useAtom(store.userBalancesAtom);

  const [isLoading, setIsLoading] = useState(false);

  const sendForm = useForm<ISendFormData>({
    mode: "onChange",
    defaultValues: {
      chainId: 1,
      amount: 0,
      token: "eth",
    },
  });

  const formwatch = sendForm.watch();

  /** */
  function walletClientToSigner(walletClient: WalletClient) {
    const { account, chain, transport } = walletClient;
    const network = {
      chainId: chain.id,
      name: chain.name,
      ensAddress: chain.contracts?.ensRegistry?.address,
    };
    const provider = new BrowserProvider(transport, network);
    const signer = new JsonRpcSigner(provider, account.address);
    return signer;
  }

  /** Hook to convert a viem Wallet Client to an ethers.js Signer. */
  function useEthersSigner({ chainId }: { chainId?: number } = {}) {
    const { data: walletClient } = useWalletClient({ chainId });
    return useMemo(
      () => (walletClient ? walletClientToSigner(walletClient) : undefined),
      [walletClient]
    );
  }

  // Use the hook here at the beginning of function component.
  const signer = useEthersSigner();

  const createLink = async (sendFormData: ISendFormData) => {
    //check that the token and chainid are defined
    if (sendFormData.chainId == null || sendFormData.token == null) {
      toast("please select a chain and token", {
        position: "bottom-right",
      });
      return;
    }

    //check if the amount is less than or equal to zero
    if (sendFormData.amount <= 0) {
      toast("please put an amount that is greater than zero", {
        position: "bottom-right",
      });
      return;
    }

    //check that the user has enough funds
    const balance = userBalances.find(
      (balance) => balance.symbol === sendFormData.token
    )?.amount;
    if (balance && sendFormData.amount > balance) {
      toast("you don't have enough funds", {
        position: "bottom-right",
      });
      return;
    }

    setIsLoading(true);

    const tokenAddress = userBalances.find(
      (balance) =>
        balance.chainId == sendFormData.chainId &&
        balance.symbol == sendFormData.token
    )?.address;

    console.log(
      "sending " +
        sendFormData.amount +
        " " +
        sendFormData.token +
        " on chain with id " +
        sendFormData.chainId +
        " with token address: " +
        tokenAddress
    );

    try {
      const { link, txReceipt } = await peanut.createLink({
        signer: signer,
        chainId: sendFormData.chainId,
        tokenAddress: tokenAddress,
        tokenAmount: Number(sendFormData.amount),
        tokenType: 0,
      });
      console.log("Created link:", link);

      setClaimLink(link);
      setTxReceipt(txReceipt);

      setTimeout(() => {
        onNextScreen();
        setIsLoading(false);
      }, 7500);
    } catch (error) {
      setIsLoading(false);
      console.log("user rejected request in wallet");
    }
  };

  //start of implementation to fetch token price to show the user the amount in USD
  //Most of the public available free api's get rate limited quiclky unless you pay for an api key.
  const updateTokenPrice = async () => {
    try {
      console.log(
        userBalances
          .find((balance) => balance.symbol === formwatch.token)
          ?.name.toLowerCase()
      );
      const response = await axios.get(
        `${COINGECKO_API_BASE_URL}/simple/price`,
        {
          params: {
            ids:
              userBalances
                .find((balance) => balance.symbol === formwatch.token)
                ?.name.toLowerCase() ?? "",
            vs_currencies: "usd", // You can change the currency here if needed
          },
        }
      );

      const price = response.data[formwatch.token];
      console.log(price);
    } catch (error) {
      console.log("error in updateTokenPrice", error);
    }
  };

  //if the userbalances have been updated, make sure to set the default token to the first one (which will be selected by default in the dropdown)
  useEffect(() => {
    if (userBalances.length > 0) {
      sendForm.setValue("token", userBalances[0].symbol);
      sendForm.setValue("chainId", userBalances[0].chainId);
    }
  }, [userBalances]);

  useEffect(() => {
    if (formwatch.chainId) {
      //if the user changes the chain, make sure to set the default token to the first one (which will be selected by default in the dropdown)
      sendForm.setValue(
        "token",
        userBalances.find(
          (balance) =>
            balance.chainId.toString() === formwatch.chainId.toString()
        )?.symbol ?? ""
      );
    }
  }, [formwatch.chainId]);

  return (
    <>
      <div className="mt-6 text-center  w-full flex flex-col gap-5 ">
        <h2 className="title-font text-3xl lg:text-5xl bold m-0">
          Send crypto with a link
          <span className="text-teal font-bold text-lg lg:text-2xl ml-2">
            BETA
          </span>
        </h2>
        <h3 className="text-lg lg:text-2xl font-bold m-0">
          Peanut Protocol Demo
        </h3>

        <div className="text-base p-5 px-6 w-11/12 lg:w-2/3 mx-auto m-0">
          Choose the chain, set the amount, confirm the transaction. You'll get
          a trustless payment link. Send it to whomever you want.
        </div>
      </div>
      <form className="w-full" onSubmit={sendForm.handleSubmit(createLink)}>
        <div className="flex w-full flex-col gap-5 items-center">
          <div className="flex gap-2 w-full px-2 sm:w-3/4 lg:w-3/5">
            <div className="relative w-full lg:max-w-sm">
              <select
                className="w-full h-10 p-2.5 text-black brutalborder rounded-md shadow-sm outline-none focus:border-black appearance-none"
                {...sendForm.register("chainId")}
              >
                {consts.CHAIN_MAP.map((chain) =>
                  userBalances.length > 0 ? (
                    userBalances.some(
                      (balance) => balance.chainId === chain.chainId
                    ) ? (
                      <option key={chain.name} value={chain.chainId}>
                        {chain.name}
                      </option>
                    ) : null
                  ) : (
                    <option key={chain.name} value={chain.chainId}>
                      {chain.name}
                    </option>
                  )
                )}
              </select>
            </div>
            <div className="relative w-full lg:max-w-sm">
              <select
                className="w-full h-10 p-2.5 text-black brutalborder rounded-md shadow-sm outline-none focus:border-black appearance-none"
                {...sendForm.register("token")}
              >
                {userBalances.length > 0 ? (
                  userBalances.map((balance) =>
                    balance.chainId.toString() ===
                    formwatch.chainId.toString() ? (
                      <option key={balance.symbol} value={balance.symbol}>
                        {balance.symbol} -{" "}
                        {Math.round(balance.amount * 10000) / 10000}
                      </option>
                    ) : null
                  )
                ) : (
                  <option key={"ETH"} value={"ETH"}>
                    {"ETH"}
                  </option>
                )}
              </select>
            </div>
          </div>
          <div className="relative w-full px-2 sm:w-3/4 ">
            <div className="absolute box-border inset-y-0 right-4 flex items-center ">
              <span className="cursor-pointertext-lg px- ">
                <button
                  type="button"
                  className={
                    (denomination == "USD"
                      ? "bg-black text-white color-white"
                      : "font-normal bg-white ") +
                    "cursor-pointer relative inline-flex items-center border-2 border-black p-1 px-2 sm:p-2 sm:px-4"
                  }
                  onClick={() => {
                    setDenomination("USD");
                  }}
                >
                  $
                </button>
              </span>
              <span className="cursor-pointer text-lg pl-2 ">
                <button
                  type="button"
                  className={
                    (denomination == "TOKEN"
                      ? "font-black bg-black text-white color-white"
                      : "font-normal bg-white ") +
                    "cursor-pointer relative inline-flex items-center border-2 border-black p-1 px-2 sm:p-2 sm:px-4 "
                  }
                  onClick={() => {
                    setDenomination("TOKEN");
                  }}
                >
                  Token
                </button>
              </span>
            </div>
            <input
              type="number"
              step="any"
              min="0"
              autoComplete="off"
              className="no-spin block w-full py-4 px-2 brutalborder   placeholder:text-lg placeholder:text-black placeholder:font-bold font-bold text-lg outline-none appearance-none "
              placeholder="0.00"
              aria-describedby="price-currency"
              {...sendForm.register("amount")}
            />
          </div>
          <button
            type={isConnected ? "submit" : "button"}
            className="block w-full px-2 sm:w-2/5 lg:w-1/2 p-5 my-8 mb-4 mx-auto font-black text-2xl cursor-pointer bg-white"
            id="cta-btn"
            onClick={!isConnected ? open : undefined}
          >
            {isLoading ? (
              <div role="status">
                <svg
                  aria-hidden="true"
                  className="inline w-6 h-6 text-black animate-spin dark:text-black fill-white"
                  viewBox="0 0 100 101"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
                    fill="currentColor"
                  />
                  <path
                    d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
                    fill="currentFill"
                  />
                </svg>
                <span className="sr-only">Loading...</span>
              </div>
            ) : isConnected ? (
              "Send"
            ) : (
              "Connect Wallet"
            )}
          </button>
        </div>
      </form>
      <div>
        <h4>
          Hit us up on{" "}
          <Link className="text-black" href={""}>
            Discord
          </Link>
          !
        </h4>
      </div>
      <img
        src={peanutman_presenting.src}
        className="w-1/3 scale-100 absolute -bottom-48 -left-12"
        id="peanutman-presenting"
      />
    </>
  );
}
