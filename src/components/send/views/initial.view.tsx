import Link from "next/link";
import { useEffect, useState, useCallback, useMemo, Fragment } from "react";
import { useWeb3Modal } from "@web3modal/react";
import { useAtom } from "jotai";
import { useAccount, useNetwork, WalletClient } from "wagmi";
import { switchNetwork, getWalletClient } from "@wagmi/core";
import { providers } from "ethers";
import { useForm } from "react-hook-form";
import peanutman_logo from "@/assets/peanutman-logo.svg";
const peanut = require("@squirrel-labs/peanut-sdk");
import { Dialog, Transition } from "@headlessui/react";

import * as store from "@/store";
import * as consts from "@/consts";
import * as _consts from "../send.consts";
import * as utils from "@/utils";
import * as _utils from "../send.utils";
import * as hooks from "@/hooks";
import * as global_components from "@/components/global";
import axios from "axios";


export function SendInitialView({
  onNextScreen,
  setClaimLink,
  setTxReceipt,
  setChainId,
}: _consts.ISendScreenProps) {
  //hooks
  const { open } = useWeb3Modal();
  const { isConnected, address, isDisconnected } = useAccount();
  const { chain: currentChain } = useNetwork();

  //local states
  const [signer, setSigner] = useState<providers.JsonRpcSigner | undefined>(
    undefined
  );
  const [tokenList, setTokenList] = useState<_consts.ITokenListItem[]>([]);
  const [formHasBeenTouched, setFormHasBeenTouched] = useState(false);
  const [prevChainId, setPrevChainId] = useState<number | undefined>(undefined);
  const [isTokenSelectorOpen, setIsTokenSelectorOpen] = useState(false);
  const [enableConfirmation, setEnableConfirmation] = useState(false);
  const [textFontSize, setTextFontSize] = useState("text-6xl");
  const [loadingStates, setLoadingStates] =
    useState<consts.LoadingStates>("idle");
  const [errorState, setErrorState] = useState<{
    showError: boolean;
    errorMessage: string;
  }>({ showError: false, errorMessage: "" });
  //global states
  const [userBalances] = useAtom(store.userBalancesAtom);
  const [chainDetails] = useAtom(store.defaultChainDetailsAtom);
  const [supportedChainsSocketTech] = useAtom(
    store.supportedChainsSocketTechAtom
  );
  const [tokenDetails] = useAtom(store.defaultTokenDetailsAtom);

  //memo
  const isLoading = useMemo(() => loadingStates !== "idle", [loadingStates]);
  hooks.useConfirmRefresh(enableConfirmation);

  //form and modalform states
  const sendForm = useForm<_consts.ISendFormData>({
    mode: "onChange",
    defaultValues: {
      chainId: 1,
      amount: 0,
      token: "",
    },
  });
  const formwatch = sendForm.watch();
  const [modalState, setModalState] = useState<{
    chainId: number;
    token: string;
  }>({
    chainId: formwatch.chainId,
    token: formwatch.token,
  });

  const getWalletClientAndUpdateSigner = async ({
    chainId,
  }: {
    chainId: number;
  }) => {
    const walletClient = await getWalletClient({ chainId: Number(chainId) });
    if (walletClient) {
      const signer = _utils.walletClientToSigner(walletClient);
      setSigner(signer);
    }
  };

  const checkForm = (sendFormData: _consts.ISendFormData) => {
    //check that the token and chainid are defined
    if (sendFormData.chainId == null || sendFormData.token == "") {
      setErrorState({
        showError: true,
        errorMessage: "Please select a chain and token",
      });
      return { succes: "false" };
    }

    //check if the amount is less than or equal to zero
    if (sendFormData.amount <= 0) {

      setErrorState({
        showError: true,
        errorMessage: "Please put an amount that is greater than zero",
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
        setErrorState({
          showError: true,
          errorMessage: "You don't have enough funds",
        });
        
        return { succes: "false" };
      }

      if (!signer) {
        getWalletClientAndUpdateSigner({ chainId: sendFormData.chainId });
        setErrorState({
          showError: true,
          errorMessage: "Signer undefined, please refresh",
        });
       
        return { succes: "false" };
      }
    }
    return { succes: "true" };
  };

  const createLink = useCallback(
    async (sendFormData: _consts.ISendFormData) => {
      if (isLoading) return;
      try {
        setLoadingStates("checking inputs...");

        if (checkForm(sendFormData).succes === "false") {
          return;
        }
        setEnableConfirmation(true);

        const { tokenAddress, tokenDecimals, tokenType } =
          _utils.getTokenDetails(sendFormData, userBalances, tokenDetails, chainDetails);

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
          

          await utils
            .waitForPromise(
              switchNetwork({ chainId: Number(sendFormData.chainId) })
            )
            .catch((error) => {
              setErrorState({
                showError: true,
                errorMessage: "Something went wrong while switching networks",
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

          setErrorState({
            showError: true,
            errorMessage: "You don't have enough funds",
          });
        } else {

          setErrorState({
            showError: true,
            errorMessage: "Something failed while creating your link. Please try again",
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

  useEffect(() => {
    if (currentChain && !formHasBeenTouched) {
      sendForm.setValue("chainId", currentChain.id);
    }
  }, [currentChain]);

  useEffect(() => {
    if (tokenList && !isTokenSelectorOpen) {
      sendForm.setValue(
        "token",
        tokenList.find((token) => token.chainId == formwatch.chainId)?.symbol ??
          ""
      );
    }
  }, [tokenList]);

  useEffect(() => {
    if (formwatch.chainId != prevChainId) {
      setPrevChainId(formwatch.chainId);
      setTimeout(() => {
        getWalletClientAndUpdateSigner({ chainId: formwatch.chainId });
      }, 2000);
    }
  }, [formwatch.chainId, isConnected]);

  useEffect(() => {
    setModalState({
      chainId: modalState.chainId,
      token:
        userBalances.find((token) => token.chainId == modalState.chainId)
          ?.symbol ?? "",
    });
    userBalances.some((balance) => balance.chainId == modalState.chainId)
      ? setTokenList(
          userBalances
            .filter((balance) => balance.chainId == modalState.chainId)
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
  }, [modalState.chainId]);

  useEffect(() => {
    if (modalState.token && modalState.chainId) {
      const tokenAddress = tokenList.find(
        (token) => token.symbol == modalState.token
      )?.address ?? '';
      const tokenPrice = _utils.getTokenPrice(tokenAddress, modalState.chainId);
    }
  }, [modalState.token]);

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
          <div className="sm:w-3/4 gap-6 items-center p-4 justify-center hidden sm:flex flex-row">
            <div className="flex flex-col gap-0 justify-end pt-2 ">
              <div className="flex items-center h-16">
                <label className={"font-bold " + textFontSize}>$</label>
                <div className="w-full max-w-[160px] ">
                  <input
                    className={
                      "w-full no-spin block border-none placeholder:text-black placeholder:font-black font-black tracking-wide outline-none appearance-none " +
                      textFontSize
                    }
                    placeholder="0.00"
                    onChange={(e) => {
                      setTextFontSize(_utils.textHandler(e.target.value));
                    }}
                  />
                </div>
              </div>

              <label className="text-sm font-bold pr-2 w-max self-center">
                70.845 MATIC
              </label>
            </div>
            <div
              className="w-124 border-solid border-4 flex flex-col !py-1 !px-8 gap-2 h-max cursor-pointer"
              id="cta-div"
              onClick={() => setIsTokenSelectorOpen(true)}
            >
              <label className="font-bold text-sm overflow-hidden overflow-ellipsis break-all whitespace-nowrap">
                {" "}
                {
                  chainDetails.find(
                    (chain) => chain.chainId == formwatch.chainId
                  )?.name
                }
              </label>{" "}
              <label className="font-bold text-xl overflow-hidden overflow-ellipsis break-all whitespace-nowrap">
                {" "}
                {formwatch.token}
              </label>
            </div>
          </div>
          <div className="w-full gap-6 items-center p-4 justify-center flex flex-col sm:hidden ">
            <div
              className=" flex w-124 border-solid border-4 flex flex-col !py-1 !px-8 gap-2 h-max"
              id="cta-div"
              onClick={() => setIsTokenSelectorOpen(true)}
            >
              <label className="font-bold text-sm self-center overflow-hidden overflow-ellipsis break-all whitespace-nowrap">
                {
                  chainDetails.find(
                    (chain) => chain.chainId == formwatch.chainId
                  )?.name
                }
              </label>{" "}
              <label className="font-bold text-xl self-center overflow-hidden overflow-ellipsis break-all whitespace-nowrap">
                {formwatch.token}
              </label>
            </div>
            <div className="flex flex-col gap-0 justify-end pt-2">
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
                    setTextFontSize(_utils.textHandler(e.target.value));
                  }}
                />
              </div>

              <label className="text-sm font-bold pr-2 w-max ml-4">
                70.845 MATIC
              </label>
            </div>
          </div>

          <div
            className={
              errorState.showError
                ? "w-full flex flex-col items-center gap-10 my-8 mx-auto mb-0 "
                : "w-full flex flex-col items-center my-8 mx-auto mb-14 "
            }
          >
            <button
              type={isConnected ? "submit" : "button"}
              className="block w-full px-2 sm:w-2/5 lg:w-1/2 p-5  font-black text-2xl cursor-pointer bg-white"
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
            {errorState.showError && (
              <div className="text-center">
                <label className="text-red font-bold ">
                  {errorState.errorMessage}
                </label>
              </div>
            )}
          </div>
        </div>
      </form>

      <global_components.PeanutMan type="presenting" />
      <Transition.Root show={isTokenSelectorOpen} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-10"
          onClose={() => {
            sendForm.setValue("token", modalState.token);
            sendForm.setValue("chainId", modalState.chainId);
            setIsTokenSelectorOpen(false);
          }}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-75 transition-opacity" />
          </Transition.Child>

          <div className="fixed inset-0 z-10 overflow-y-auto">
            <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                enterTo="opacity-100 translate-y-0 sm:scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              >
                <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-sm sm:p-6 rounded-none	brutalborder text-black min-h-[240px]">
                  <div className="w-full flex flex-wrap text-black gap-2 mb-2 ">
                    {chainDetails.map(
                      (chain) =>
                        chain.chainId ==
                          userBalances.find(
                            (balance) => balance.chainId == chain.chainId
                          )?.chainId && (
                          <div
                            key={chain.chainId}
                            className={
                              "flex flex-row gap-2 align-center w-max softborder px-2 py-1 cursor-pointer " +
                              (modalState.chainId == chain.chainId
                                ? "bg-black text-white"
                                : "")
                            }
                            onClick={() => {
                              setModalState({
                                chainId: chain.chainId,
                                token: modalState.token,
                              });
                            }}
                          >
                            <img src={peanutman_logo.src} className="h-6" />
                            <label>{chain.shortName}</label>
                          </div>
                        )
                    )}
                  </div>
                  <input
                    placeholder="Search"
                    className="w-full brutalborder px-2 py-2 text-lg"
                  />
                  <div className="flex flex-col mt-2 gap-2">
                    {tokenList.map((token) => (
                      <div
                        key={token.symbol}
                        className={
                          "flex flex-row justify-between cursor-pointer px-2 py-1  " +
                          (modalState.token == token.symbol
                            ? " bg-black text-white"
                            : "")
                        }
                        onClick={() => {
                          setModalState({
                            chainId: modalState.chainId,
                            token: token.symbol,
                          });
                        }}
                      >
                        <div className="flex gap-2 items-center ">
                          <img src={peanutman_logo.src} className="h-6" />
                          <div>{token.symbol}</div>
                        </div>
                        <div className="flex gap-2 items-center">
                          <div>{utils.formatTokenAmount(token.amount)}</div>{" "}
                          <div>{token.symbol}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition.Root>
    </>
  );
}
