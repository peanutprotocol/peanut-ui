import { useState } from "react";

import clipboard_svg from "@/assets/clipboard.svg";
import dropdown_svg from "@/assets/dropdown.svg";

import * as _consts from "../send.consts";

export function SendSuccessView({ onNextScreen }: _consts.ISendScreenProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const link = "test";

  return (
    <div className="flex flex-col items-center center-xy pt-1 pb-8 px-4 w-1/2 lg:w-<1>/2 brutalborder bg-white mx-auto mt-5 text-black">
      <div className="text-center w-3/4">
        <h2 className="title-font text-5xl font-black text-black">Yay!</h2>
        <p className="mt-2 text-lg">
          {/* Add the msg here */}
          Send this link to your friend so they can claim their funds.
        </p>
        <div className="flex w-5/6 mx-auto brutalborder mt-4">
          <div
            id="myInput"
            className="p-2 w-11/12 bg-black text-white flex items-center text-lg"
          >
            {link}
          </div>

          <div
            className="tooltip h-14 w-16 block p-2 cursor-pointer"
            onClick={() => {
              navigator.clipboard.writeText(link);
              setIsCopied(true);
            }}
          >
            {isCopied ? (
              <div className="flex text-base font-bold border-none bg-white cursor-pointer h-full items-center">
                <span className="tooltiptext inline " id="myTooltip">
                  {" "}
                  copied!{" "}
                </span>
              </div>
            ) : (
              <button className="text-base font-bold border-none bg-white cursor-pointer">
                <span className="tooltiptext inline" id="myTooltip">
                  COPY
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
            <div className="mx-auto mt-8 mb-12 h-42 w-42">
              <div className="mx-auto mt-8 mb-12 h-42 w-42">
                <img alt="QR code" className="mx-auto" />
              </div>
            </div>
            <p className="tx-sm">
              <a target="_blank" className="text-sm text-center underline ">
                Your transaction hash
              </a>
            </p>

            {/* <p className="mt-4">
          If you input an email address, we'll send them the link there too!
        </p> whats this? */}
          </div>
        )}
        <p className="mt-4 text-xs" id="to_address-description">
          {" "}
          Thoughts? Feedback? Use cases? Memes? Hit us up on{" "}
          <a
            href="https://discord.gg/BX9Ak7AW28"
            target="_blank"
            className="underline text-black"
          >
            Discord
          </a>
          !
        </p>
      </div>
    </div>
  );
}
