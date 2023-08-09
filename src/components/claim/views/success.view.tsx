import { useEffect, useMemo, useState } from "react";
import { useAtom } from "jotai";

import * as _consts from "../claim.consts";
import * as store from "@/store/";

import dropdown_svg from "@/assets/dropdown.svg";
import peanutman_cheering from "@/assets/peanutman-cheering.svg";
import { useRouter } from "next/navigation";

export function ClaimSuccessView({
  txHash,
  claimDetails,
}: _consts.IClaimScreenProps) {
  const router = useRouter();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [chainDetails] = useAtom(store.defaultChainDetailsAtom);

  const explorerUrlWithTx = useMemo(
    () =>
      chainDetails.find((detail) => detail.chainId === claimDetails.chainId)
        ?.explorers[0].url +
      "/tx/" +
      txHash,
    [txHash, chainDetails]
  );

  useEffect(() => {
    router.prefetch("/");
  }, []);

  return (
    <>
      <h2 className="title-font text-3xl md:text-5xl font-black mb-0">
        Congratulations!
      </h2>
      <p className="mt-3 text-lg break-words mb-0 text-center">
        You have successfully claimed your funds.
      </p>
      <div
        className="cursor-pointer flex justify-center items-center mt-2"
        onClick={() => {
          setIsDropdownOpen(!isDropdownOpen);
        }}
      >
        <div className="cursor-pointer text-sm bg-white border-none  ">
          Check Transaction{" "}
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
        <div className="sm:p-0 m-2 text-base text-center flex flex-col justify-center items-center gap-2">
          <p className="m-0">
            <a
              href={explorerUrlWithTx ?? ""}
              className="text-center text-sm underline font-bold break-all text-black cursor-pointer"
            >
              {txHash}
            </a>
          </p>
          <p className="m-0">
            <small>
              Click the confirmation above and check <b>Internal Txs</b>. It
              might be slow.
            </small>
          </p>
          <p className="m-0">
            <small>
              If you don't see the funds in your wallet, make sure you are on
              the right chain.
            </small>
          </p>
        </div>
      )}
      <button
        className="block w-full mt-4 mb-4 px-2 sm:w-2/5 lg:w-1/2 p-5 mx-auto font-black text-2xl cursor-pointer bg-white"
        id="cta-btn"
        onClick={() => {
          router.push("/");
        }}
      >
        Send Crypto
      </button>
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
        src={peanutman_cheering.src}
        className="w-1/3 scale-100 absolute z-index-100 -bottom-32 -left-8 sm:-bottom-24 sm:-left-16 md:-bottom-32 md:-left-32 2xl:-bottom-48 2xl:-left-64"
        id="peanutman-presenting"
      />
    </>
  );
}

//todo: make global comps out of button style and thought... text
//todo: add peanutman
