import { useWeb3Modal } from "@web3modal/react";
import { useEffect, useState } from "react";
import { WalletClient, useAccount, useNetwork } from "wagmi";
import { useAtom } from "jotai";
import { getWalletClient, switchNetwork } from "@wagmi/core";
const peanut = require("@squirrel-labs/peanut-sdk");
import toast from "react-hot-toast";

import * as global_components from "@/components/global";
import * as _consts from "../claim.consts";
import * as utils from "@/utils";
import * as store from "@/store";

import dropdown_svg from "@/assets/dropdown.svg";
import tokenDetails from "@/consts/tokenDetails.json";

import peanutman_presenting from "@/assets/peanutman-presenting.svg";
import { BrowserProvider, JsonRpcSigner } from "ethers";
import { useForm } from "react-hook-form";

export function ClaimView({
  onNextScreen,
  claimDetails,
  claimLink,
  setTxHash,
}: _consts.IClaimScreenProps) {
  const { isConnected } = useAccount();
  const { open } = useWeb3Modal();
  const [isLoading, setIsLoading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [chainDetails] = useAtom(store.defaultChainDetailsAtom);
  const { chain: currentChain } = useNetwork();

  const [signer, setSigner] = useState<JsonRpcSigner | undefined>(undefined);

  const manualForm = useForm<{ address: string }>({
    mode: "onChange",
    reValidateMode: "onChange",
    defaultValues: {
      address: "",
    },
  });

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

  const claim = async () => {
    try {
      setIsLoading(true);
      if (!signer) {
        await getWalletClientAndUpdateSigner({ chainId: claimDetails.chainId });
      }
      //check if the user is on the correct chain
      if (currentChain?.id.toString() !== claimDetails.chainId.toString()) {
        toast("Please allow the switch to the correct network in your wallet", {
          position: "bottom-right",
        });

        await utils
          .waitForPromise(
            switchNetwork({ chainId: Number(claimDetails.chainId) })
          )
          .catch((error) => {
            toast("Something went wrong while switching networks", {
              position: "bottom-right",
            });
            return;
          });
      }
      if (claimLink) {
        console.log("claiming link: https://peanut.to/claim?" + claimLink);
        const claimTx = await peanut.claimLink({
          signer,
          link: "https://peanut.to/claim?" + claimLink,
        });
        console.log(claimTx);
        setTxHash(claimTx.hash ?? "");
        onNextScreen();
      }
    } catch (error) {
      toast("Something went wrong while claiming", {
        position: "bottom-right",
      });
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const manualClaim = async (data: { address: string }) => {
    try {
      setIsLoading(true);
      if (claimLink && data.address) {
        console.log("claiming link: https://peanut.to/claim?" + claimLink);
        const claimTx = await peanut.claimLinkGasless(
          "https://peanut.to/claim?" + claimLink,
          data.address,
          process.env.PEANUT_API_KEY
        );
        console.log(claimTx);
        setTxHash(claimTx.hash ?? "");
        onNextScreen();
      }
    } catch (error) {
      toast("Something went wrong while claiming", {
        position: "bottom-right",
      });
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected) {
      //wait for the wallet to connect
      setTimeout(() => {
        getWalletClientAndUpdateSigner({ chainId: claimDetails.chainId });
      }, 1000);
    }
  }, [isConnected]);

  return (
    <>
      <h2 className="my-2 text-3xl lg:text-6xl mb-0 font-black">
        Claim{" "}
        {utils.formatAmountWithDecimals({
          amount: claimDetails.amount,
          decimals: claimDetails.decimals,
        })}{" "}
        {
          tokenDetails
            .find((detail) => Number(detail.chainId) == claimDetails.chainId)
            ?.tokens.find((token) => token.address == claimDetails.tokenAddress)
            ?.symbol
        }
      </h2>
      <h3 className="text-md sm:text-lg lg:text-xl mb-8 text-center">
        {chainDetails &&
          chainDetails.find((chain) => chain.chainId == claimDetails.chainId)
            ?.name}
      </h3>
      <button
        type={isConnected ? "submit" : "button"}
        className="block w-full mb-4 px-2 sm:w-2/5 lg:w-1/2 p-5 mx-auto font-black text-2xl cursor-pointer bg-white"
        id="cta-btn"
        onClick={!isConnected ? open : claim}
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
          "Claim"
        ) : (
          "Connect to claim"
        )}
      </button>
      <div
        className="cursor-pointer flex justify-center items-center mt-2"
        onClick={() => {
          setIsDropdownOpen(!isDropdownOpen);
        }}
      >
        <div className="cursor-pointer text-sm bg-white border-none  ">
          manually enter address
        </div>
        <img
          style={{
            transform: isDropdownOpen ? "scaleY(-1)" : "none",
            transition: "transform 0.3s ease-in-out",
          }}
          src={dropdown_svg.src}
          alt=""
          className={"h-6 "}
        />
      </div>
      {isDropdownOpen && (
        <global_components.CardWrapper>
          <label className="block text-xs font-medium text-center">
            If you can't connect, you can also write your address below <br />{" "}
            <span className="italic">
              ⚠️ WARNING: if you enter a wrong address, funds will get lost!!
            </span>
          </label>

          <form
            className="mt-4 flex flex-row w-11/12 sm:w-3/4 mx-auto brutalborder"
            onSubmit={manualForm.handleSubmit(manualClaim)}
          >
            <input
              type="text"
              className="h-4 w-full px-9 p-4 placeholder:font-light placeholder:text-xs flex-grow border-none"
              placeholder="0x6B37..."
              {...manualForm.register("address", {
                required: true,
              })}
            />
            <div className="tooltip h-4 w-1/8 block p-2 cursor-pointer brutalborder-left">
              {isLoading ? (
                <div className="flex text-base font-bold border-none bg-white cursor-pointer h-full items-center">
                  <span className="tooltiptext inline " id="myTooltip">
                    Claiming...
                  </span>
                </div>
              ) : (
                <button
                  className="flex text-base font-bold border-none bg-white cursor-pointer h-full items-center"
                  type="submit"
                >
                  <span className="tooltiptext inline" id="myTooltip">
                    Claim
                  </span>
                </button>
              )}
            </div>
          </form>

          <div className="flex flex-row h-4 items-center mx-auto mt-2 justify-center">
            <input type="checkbox" className="h-4 w-4" />
            <label className="ml-2 text-xs font-medium">
              This address exists on CHAIN
            </label>
          </div>
        </global_components.CardWrapper>
      )}
      <p className="mt-4 text-xs text-center">
        Thoughts? Feedback? Use cases? Memes? Hit us up on{" "}
        <a
          href="https://discord.gg/BX9Ak7AW28"
          target="_blank"
          className="underline text-black cursor-pointer"
        >
          Discord
        </a>
        !
      </p>
      <img
        src={peanutman_presenting.src}
        className="w-1/3 scale-100 absolute z-index-100 -bottom-32 -left-8 sm:-bottom-24 sm:-left-16 md:-bottom-32 md:-left-32 2xl:-bottom-48 2xl:-left-64"
        id="peanutman-presenting"
      />
    </>
  );
}
