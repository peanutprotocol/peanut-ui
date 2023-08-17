import Link from "next/link";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useWeb3Modal } from "@web3modal/react";
import { useAtom } from "jotai";
import toast from "react-hot-toast";
import { useAccount, useNetwork, WalletClient } from "wagmi";
import { switchNetwork, getWalletClient } from "@wagmi/core";
import { providers } from "ethers";
import { useForm } from "react-hook-form";
import dropdown_svg from "@/assets/dropdown.svg";
import peanutman_logo from "@/assets/peanutman-logo.svg";
const peanut = require("@squirrel-labs/peanut-sdk");

import * as store from "@/store";
import * as consts from "@/consts";
import * as _consts from "../send.consts";
import * as utils from "@/utils";
import * as hooks from "@/hooks";
import * as global_components from "@/components/global";
interface ISendFormData {
  chainId: number;
  token: string;
  amount: number;
}

export function SendInitialView({
  onNextScreen,
  setClaimLink,
  setTxReceipt,
  setChainId,
}: _consts.ISendScreenProps) {
  const { open } = useWeb3Modal();
  const { isConnected, address } = useAccount();
  const { chain: currentChain } = useNetwork();
  const [signer, setSigner] = useState<providers.JsonRpcSigner | undefined>(
    undefined
  );
  const [tokenList, setTokenList] = useState<ITokenListItem[]>([]);
  const [formHasBeenTouched, setFormHasBeenTouched] = useState(false);
  const [userBalances] = useAtom(store.userBalancesAtom);
  const [chainDetails] = useAtom(store.defaultChainDetailsAtom);
  const [supportedChainsSocketTech] = useAtom(
    store.supportedChainsSocketTechAtom
  );
  const [tokenDetails] = useAtom(store.defaultTokenDetailsAtom);
  const [prevChainId, setPrevChainId] = useState<number | undefined>(undefined);
  const [isTokenSelectorOpen, setIsTokenSelectorOpen] = useState(false);

  const [loadingStates, setLoadingStates] =
    useState<consts.LoadingStates>("idle");
  const isLoading = useMemo(() => loadingStates !== "idle", [loadingStates]);

  const [enableConfirmation, setEnableConfirmation] = useState(false);

  hooks.useConfirmRefresh(enableConfirmation);

  const sendForm = useForm<ISendFormData>({
    mode: "onChange",
    defaultValues: {
      chainId: 1,
      amount: 0,
      token: "",
    },
  });
  const formwatch = sendForm.watch();
  interface ITokenListItem {
    symbol: string;
    amount: number;
    chainId: number;
    address: string;
    decimals: number;
    logo: string;
  }

  function walletClientToSigner(walletClient: WalletClient) {
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

  const getWalletClientAndUpdateSigner = async ({
    chainId,
  }: {
    chainId: number;
  }) => {
    const walletClient = await getWalletClient({ chainId: Number(chainId) });
    if (walletClient) {
      const signer = walletClientToSigner(walletClient);
      setSigner(signer);
    }
  };

  const checkForm = (sendFormData: ISendFormData) => {
    //check that the token and chainid are defined
    if (sendFormData.chainId == null || sendFormData.token == "") {
      toast("Please select a chain and token", {
        position: "bottom-right",
      });
      return { succes: "false" };
    }

    //check if the amount is less than or equal to zero
    if (sendFormData.amount <= 0) {
      toast("Please put an amount that is greater than zero", {
        position: "bottom-right",
      });
      return { succes: "false" };
    }

    //check if the token is in the userBalances
    if (
      userBalances.some(
        (balance) =>
          balance.symbol == sendFormData.token &&
          balance.chainId == sendFormData.chainId
      )
    ) {
      //check that the user has enough funds
      const balance = userBalances.find(
        (balance) => balance.symbol === sendFormData.token
      )?.amount;
      if (balance && sendFormData.amount > balance) {
        toast("You don't have enough funds", {
          position: "bottom-right",
        });
        return { succes: "false" };
      }

      if (!signer) {
        getWalletClientAndUpdateSigner({ chainId: sendFormData.chainId });
        toast("Signer undefined, please refresh", {
          position: "bottom-right",
        });
        return { succes: "false" };
      }
    }
    return { succes: "true" };
  };

  const getTokenDetails = useCallback(
    (sendFormData: ISendFormData) => {
      let tokenAddress: string = "";
      let tokenDecimals: number = 18;
      if (
        userBalances.some(
          (balance) =>
            balance.symbol == sendFormData.token &&
            balance.chainId == sendFormData.chainId
        )
      ) {
        tokenAddress =
          userBalances.find(
            (balance) =>
              balance.chainId == sendFormData.chainId &&
              balance.symbol == sendFormData.token
          )?.address ?? "";
        tokenDecimals =
          userBalances.find(
            (balance) =>
              balance.chainId == sendFormData.chainId &&
              balance.symbol == sendFormData.token
          )?.decimals ?? 18;
      } else {
        tokenAddress =
          tokenDetails
            .find(
              (detail) =>
                detail.chainId.toString() == sendFormData.chainId.toString()
            )
            ?.tokens.find((token) => token.symbol == sendFormData.token)
            ?.address ?? "";

        tokenDecimals =
          tokenDetails
            .find(
              (detail) =>
                detail.chainId.toString() == sendFormData.chainId.toString()
            )
            ?.tokens.find((token) => token.symbol == sendFormData.token)
            ?.decimals ?? 18;
      }

      const tokenType =
        chainDetails.find((detail) => detail.chainId == sendFormData.chainId)
          ?.nativeCurrency.symbol == sendFormData.token
          ? 0
          : 1;

      return { tokenAddress, tokenDecimals, tokenType };
    },
    [userBalances, tokenDetails, chainDetails]
  );

  const createLink = useCallback(
    async (sendFormData: ISendFormData) => {
      if (isLoading) return;
      try {
        setLoadingStates("checking inputs...");

        if (checkForm(sendFormData).succes === "false") {
          return;
        }
        setEnableConfirmation(true);

        const { tokenAddress, tokenDecimals, tokenType } =
          getTokenDetails(sendFormData);

        console.log(
          "sending " +
            sendFormData.amount +
            " " +
            sendFormData.token +
            " on chain with id " +
            sendFormData.chainId +
            " with token address: " +
            tokenAddress +
            " with tokenType: " +
            tokenType +
            " with tokenDecimals: " +
            tokenDecimals
        );

        setLoadingStates("allow network switch...");
        //check if the user is on the correct chain
        if (currentChain?.id.toString() !== sendFormData.chainId.toString()) {
          toast(
            "Please allow the switch to the correct network in your wallet",
            {
              position: "bottom-right",
            }
          );

          await utils
            .waitForPromise(
              switchNetwork({ chainId: Number(sendFormData.chainId) })
            )
            .catch((error) => {
              toast("Something went wrong while switching networks", {
                position: "bottom-right",
              });
              return;
            });
          setLoadingStates("switching network...");
          await new Promise((resolve) => setTimeout(resolve, 4000)); // wait a sec after switching chain before making other deeplink
          setLoadingStates("loading...");
        }

        //when the user tries to refresh, show an alert
        setEnableConfirmation(true);
        setLoadingStates("executing transaction...");

        const { link, txReceipt } = await peanut.createLink({
          signer: signer,
          chainId: sendFormData.chainId,
          tokenAddress: tokenAddress ?? null,
          tokenAmount: Number(sendFormData.amount),
          tokenType: tokenType,
          tokenDecimals: tokenDecimals,
          verbose: true,
        });
        console.log("Created link:", link);
        utils.saveToLocalStorage(address + " - " + txReceipt.hash, link);

        setClaimLink(link);
        setTxReceipt(txReceipt);
        setChainId(sendFormData.chainId);

        onNextScreen();
      } catch (error: any) {
        if (error.toString().includes("insufficient funds")) {
          toast("You don't have enough funds", {
            position: "bottom-right",
          });
        } else {
          toast("Something failed while creating your link. Please try again", {
            position: "bottom-right",
          });
          console.error(error);
        }
      } finally {
        setLoadingStates("idle");
        setEnableConfirmation(false);
      }
    },
    [signer, currentChain, userBalances, onNextScreen, isLoading, address]
  );

  useEffect(() => {
    userBalances.some((balance) => balance.chainId == formwatch.chainId)
      ? setTokenList(
          userBalances
            .filter((balance) => balance.chainId == formwatch.chainId)
            .map((balance) => {
              return {
                symbol: balance.symbol,
                chainId: balance.chainId,
                amount: balance.amount,
                address: balance.address,
                decimals: balance.decimals,
                logo: "",
              };
            })
        )
      : setTokenList([]);
  }, [formwatch.chainId, userBalances, supportedChainsSocketTech]);

  // use this useEffect if you want to populate the tokendropdown with a lot of tokens. This is not recommended bc heavy af
  // useEffect(() => {
  //   if (
  //     supportedChainsSocketTech?.some(
  //       (chain) => chain.chainId == formwatch.chainId
  //     )
  //   ) {
  //     userBalances.some((balance) => balance.chainId == formwatch.chainId)
  //       ? setTokenList(
  //           userBalances
  //             .filter((balance) => balance.chainId == formwatch.chainId)
  //             .map((balance) => {
  //               return {
  //                 symbol: balance.symbol,
  //                 chainId: balance.chainId,
  //                 amount: balance.amount,
  //                 address: balance.address,
  //                 decimals: balance.decimals,
  //                 logo: "",
  //               };
  //             })
  //         )
  //       : setTokenList(
  //           tokenDetails
  //             .filter(
  //               (detail) =>
  //                 detail.chainId.toString() == formwatch.chainId.toString()
  //             )[0]
  //             .tokens.map((token) => {
  //               return {
  //                 symbol: token.symbol,
  //                 amount: 0,
  //                 chainId: formwatch.chainId,
  //                 address: token.address,
  //                 decimals: token.decimals,
  //                 logo: token.logoURI ?? "",
  //               };
  //             })
  //         );
  //   } else {
  //     setTokenList(
  //       tokenDetails
  //         .filter(
  //           (detail) =>
  //             detail.chainId.toString() == formwatch.chainId.toString()
  //         )[0]
  //         ?.tokens.map((token) => {
  //           return {
  //             symbol: token.symbol,
  //             amount: 0,
  //             chainId: formwatch.chainId,
  //             address: token.address,
  //             decimals: token.decimals,
  //             logo: token.logoURI ?? "",
  //           };
  //         })
  //     );
  //   }
  // }, [formwatch.chainId, userBalances, supportedChainsSocketTech]);

  const customChainOption = ({
    value,
    label,
    logoUri,
  }: {
    value: number;
    label: string;
    logoUri: string;
  }) => (
    <div>
      {/* <img src={logoUri} className="w-6 h-6 inline-block mr-2" /> */}
      <span>{label}</span>
    </div>
  );

  const customTokenOption = ({
    value,
    label,
    logoUri,
    amount,
  }: {
    value: string;
    label: string;
    logoUri: string;
    amount: number;
  }) => (
    <div className="flex flex-row gap-2 align-center ">
      {/* <img src={logoUri ?? ""} /> */}
      {value}

      {amount > 0 && " - " + Math.round(amount * 10000) / 10000}
    </div>
  );

  useEffect(() => {
    if (currentChain && !formHasBeenTouched) {
      sendForm.setValue("chainId", currentChain.id);
    }
  }, [currentChain]);

  useEffect(() => {
    if (formwatch.chainId != prevChainId) {
      setPrevChainId(formwatch.chainId);
      sendForm.setValue("token", "");

      //wait for the wallet to connect
      setTimeout(() => {
        getWalletClientAndUpdateSigner({ chainId: formwatch.chainId });
      }, 2000);
    }
  }, [formwatch.chainId, isConnected]);

  const [text, setText] = useState("");
  const [textFontSize, setTextFontSize] = useState("text-6xl");

  const textHandler = (text: string) => {
    if (text.length <= 4) {
      setTextFontSize("text-6xl");
    } else if (text.length > 18) {
      setTextFontSize("text-sm");
    } else if (text.length > 14) {
      setTextFontSize("text-md");
    } else if (text.length > 11) {
      setTextFontSize("text-lg");
    } else if (text.length > 8) {
      setTextFontSize("text-2xl");
    } else if (text.length > 6) {
      setTextFontSize("text-4xl");
    } else if (text.length > 4) {
      setTextFontSize("text-5xl");
    }

    setText(text);
  };

  return (
    <>
      <div className="mt-6 mb-3 sm:mb-6 text-center  w-full flex flex-col gap-5 ">
        <h2 className="title-font text-2xl lg:text-4xl bold m-0">
          Send crypto with a link
          <span className="text-teal font-bold text-lg lg:text-2xl ml-2">
            BETA
          </span>
        </h2>
      </div>
      <form className="w-full" onSubmit={sendForm.handleSubmit(createLink)}>
        <div className="flex w-full flex-col gap-0 sm:gap-5 items-center">
          {/* <div className="relative w-full px-2 sm:w-3/4 ">
            <div className="absolute box-border inset-y-0 right-4 flex items-center ">
              <button
                type="button"
                className={
                  "relative inline-flex items-center border-2 border-black p-1  sm:p-2  bg-white text-black color-white h-1/2 min-w-75 justify-center"
                }
                onClick={() => setIsTokenSelectorOpen(!isTokenSelectorOpen)}
              >
                {chainDetails.find(
                  (chain) => chain.chainId == formwatch.chainId
                )?.name ?? "Chain"}{" "}
                {" | "} {formwatch.token.length > 0 ? formwatch.token : "Token"}{" "}
                <img
                  style={{
                    transform: isTokenSelectorOpen ? "scaleY(-1)" : "none",
                    transition: "transform 0.3s ease-in-out",
                  }}
                  src={dropdown_svg.src}
                  alt=""
                  className={"h-6 "}
                />
              </button>
            </div>

            <input
              type="number"
              step="any"
              min="0"
              autoComplete="off"
              className="no-spin block w-full py-4 px-2 brutalborder pl-4 placeholder:text-lg placeholder:text-black placeholder:font-bold font-bold text-lg outline-none appearance-none "
              placeholder="0.00"
              aria-describedby="price-currency"
              {...(sendForm.register("amount"),
              {
                onChange: (e) => {
                  sendForm.setValue("amount", Number(e.target.value));
                  setFormHasBeenTouched(true);
                },
              })}
            />
          </div> */}
          <div className="sm:w-3/4 gap-6 items-center p-4 justify-center hidden sm:flex flex-row">
            <div className="flex flex-col gap-0 justify-end pt-2 ">
              <div className="flex items-center h-16">
                <label className="font-bold text-6xl">$</label>
                <div className="w-full max-w-[160px] ">
                  <input
                    className={
                      "w-full no-spin block border-none placeholder:text-black placeholder:font-black font-black tracking-wide outline-none appearance-none " +
                      textFontSize
                    }
                    placeholder="0.00"
                    onChange={(e) => {
                      textHandler(e.target.value);
                    }}
                  />
                </div>
              </div>

              <label className="text-sm font-bold pr-2 w-max self-center">
                70.845 MATIC
              </label>
            </div>
            <div
              className="min-w-124 w-max border-solid border-4 flex flex-col !py-1 !px-8 gap-2 h-max"
              id="cta-div"
            >
              <label className="font-bold text-sm">Polygon</label>{" "}
              <label className="font-bold text-xl">MATIC</label>
            </div>
          </div>
          <div className="w-full gap-6 items-center p-4 justify-center flex flex-col sm:hidden ">
            <div
              className="min-w-124 flex w-3/5 border-solid border-4 flex flex-col !py-1 !px-8 gap-2 h-max"
              id="cta-div"
            >
              <label className="font-bold text-sm">Polygon</label>{" "}
              <label className="font-bold text-xl">MATIC</label>
            </div>
            <div className="flex flex-col gap-0 justify-end pt-2 brutalborder">
              <div className="flex items-center max-w-[280px] border border-gray-400 rounded px-2 self-end ">
                <span className={"font-bold " + textFontSize}>$</span>
                <input
                  autoFocus
                  type="number"
                  className={
                    "no-spin block w-full border-none placeholder:text-black placeholder:font-black font-black tracking-wide outline-none appearance-none " +
                    textFontSize
                  }
                  placeholder="0.00"
                  onChange={(e) => {
                    textHandler(e.target.value);
                  }}
                />
              </div>

              <label className="text-sm font-bold pr-2 w-max ml-4">
                70.845 MATIC
              </label>
            </div>
          </div>

          <button
            type={isConnected ? "submit" : "button"}
            className="block w-4/5 px-2 sm:w-2/5 lg:w-1/2 p-5 my-8 mb-4 mx-auto font-black text-2xl cursor-pointer bg-white"
            id="cta-btn"
            onClick={!isConnected ? open : undefined}
            disabled={isLoading ? true : false}
          >
            {isLoading
              ? loadingStates
              : isConnected
              ? "Send"
              : "Connect Wallet"}
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

      <global_components.PeanutMan type="presenting" />
      {isTokenSelectorOpen && (
        <div className="absolute brutalborder bg-white h-1/2 w-1/2 p-4 ">
          <div className="w-full flex flex-wrap ">
            {chainDetails.map(
              (chain) =>
                chain.chainId ==
                  userBalances.find(
                    (balance) => balance.chainId == chain.chainId
                  )?.chainId && (
                  <div className="flex flex-row gap-2 align-center w-max ">
                    <img src={peanutman_logo.src} className="h-6" />
                    <label>
                      {/* {userBalances.filter((balance) => balance.chainId == chain.chainId)} */}
                    </label>
                  </div>
                )
            )}
          </div>
          <div>
            <input placeholder="Search" />
          </div>
          <div></div>
        </div>
      )}
    </>
  );
}
