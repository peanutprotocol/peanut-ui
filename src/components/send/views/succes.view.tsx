import { useMemo, useState } from "react";
import QRCode from "react-qr-code";

import clipboard_svg from "@/assets/clipboard.svg";
import dropdown_svg from "@/assets/dropdown.svg";

import * as _consts from "../send.consts";
import peanutman_cheering from "@/assets/peanutman-cheering.svg";
import { useAtom } from "jotai";
import * as store from "@/store/store";

export function SendSuccessView({
  onCustomScreen,
  claimLink,
  txReceipt,
  chainId,
}: _consts.ISendScreenProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const [chainDetails] = useAtom(store.defaultChainDetailsAtom);

  const explorerUrlWithTx = useMemo(
    () =>
      chainDetails.find((detail) => detail.chainId === chainId)?.explorers[0]
        .url +
      "/tx/" +
      txReceipt?.hash,
    [txReceipt, chainId]
  );

  return (
    <>
      <div className="text-center w-full">
        <h2 className="title-font text-5xl font-black text-black">Yay!</h2>
        <p className="mt-2 text-lg self-center">
          Send this link to your friend so they can claim their funds.
        </p>
        <div className="flex w-full brutalborder mt-4 py-2 bg-black text-white relative">
          <div className="p-2 w-[90%] overflow-hidden overflow-ellipsis break-all whitespace-nowrap bg-black text-white flex items-center text-lg">
            {claimLink}
          </div>
          <div
            className="absolute right-0 top-0 flex justify-center items-center bg-white text-black border-none h-full min-w-32 px-1 md:px-4 cursor-pointer"
            onClick={() => {
              navigator.clipboard.writeText(claimLink);
              setIsCopied(true);
            }}
          >
            {isCopied ? (
              <div className="flex text-base font-bold border-none bg-white cursor-pointer h-full items-center ">
                <span
                  className="tooltiptext inline w-full justify-center"
                  id="myTooltip"
                >
                  {" "}
                  copied!{" "}
                </span>
              </div>
            ) : (
              <button className="text-base font-bold border-none bg-white cursor-pointer h-full gap-2 p-0 ">
                <span
                  className="tooltiptext inline flex items-center leading-0 gap-2 "
                  id="myTooltip"
                >
                  <label>COPY</label>
                  <img
                    src={clipboard_svg.src}
                    className="h-6 "
                    alt="clipboard"
                  />
                </span>
              </button>
            )}
          </div>
        </div>

        <div
          className="cursor-pointer flex justify-center items-center mt-2"
          onClick={() => {
            setIsDropdownOpen(!isDropdownOpen);
          }}
        >
          <div className="cursor-pointer text-sm bg-white border-none  ">
            More Info and QR code{" "}
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
          <div>
            <div className="mx-auto mt-4 mb-6 h-42 w-42">
              <div
                style={{
                  height: "auto",
                  margin: "0 auto",
                  maxWidth: 192,
                  width: "100%",
                }}
              >
                <QRCode
                  size={256}
                  style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                  value={claimLink}
                  viewBox={`0 0 256 256`}
                />
              </div>
            </div>
            <p className="tx-sm">
              <a
                href={explorerUrlWithTx ?? ""}
                className="text-sm text-center text-black underline cursor-pointer "
              >
                Your transaction hash
              </a>
            </p>

            {/* <p className="mt-4">
          If you input an email address, we'll send them the link there too!
        </p> whats this? */}
          </div>
        )}

        <p className="mt-4 text-m" id="to_address-description">
          {" "}
          Want to do it again? click{" "}
          <a
            onClick={() => {
              onCustomScreen("INITIAL");
            }}
            target="_blank"
            className="underline text-black cursor-pointer"
          >
            here
          </a>{" "}
          to go back home!
        </p>

        <p className="mt-4 text-xs" id="to_address-description">
          {" "}
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
      </div>
      <img
        src={peanutman_cheering.src}
        className="w-1/3 scale-100 absolute z-index-100 -bottom-24 -left-8 sm:-bottom-24 sm:-left-16 md:-bottom-32 md:-left-32 2xl:-bottom-64 2xl:-left-72"
        id="peanutman-presenting"
      />
    </>
  );
}
