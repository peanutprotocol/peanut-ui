import { useEffect, useMemo, useState } from "react";
import { useAtom } from "jotai";

import * as _consts from "../claim.consts";
import * as store from "@/store/";
import * as global_components from "@/components/global";

import dropdown_svg from "@/assets/dropdown.svg";
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
          <a
            href={explorerUrlWithTx ?? ""}
            className="text-center text-sm underline font-bold break-all text-black cursor-pointer "
          >
            {txHash}
          </a>
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

      <global_components.PeanutMan type="presenting" />
    </>
  );
}
