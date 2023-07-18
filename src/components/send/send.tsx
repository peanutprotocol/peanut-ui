import { createElement, useState } from "react";
import { useForm } from "react-hook-form";

import clipboard_svg from "@/assets/clipboard.svg";
import dropdown_svg from "@/assets/dropdown.svg";

import * as _consts from "./send.consts";

export function Send() {
  const [sendScreen, setSendScreen] = useState<_consts.ISendScreenState>(
    _consts.INIT_VIEW
  );

  const handleOnNext = () => {
    const newIdx = sendScreen.idx + 1;
    setSendScreen(() => ({
      screen: _consts.SEND_SCREEN_FLOW[newIdx],
      idx: newIdx,
    }));
  };

  const sendForm = useForm<_consts.ISendFormData>({
    mode: "onChange",
    defaultValues: {
      chainId: 1,
      amount: 0,
      token: "eth",
    },
  });

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  return (
    // <div>{createElement(_consts.SEND_SCREEN_MAP[sendScreen.screen].comp)}</div>
    <div className="flex flex-col items-center center-xy pt-1 pb-8 px-4 w-1/2 lg:w-<1>/2 brutalborder bg-white mx-auto mt-5 text-black">
      <div className="text-center w-3/4">
        <h2 className="title-font text-5xl font-black text-black">Yay!</h2>
        <p className="mt-2 text-lg">
          {/* Add the msg here */}
          Send this link to your friend so they can claim their funds.
        </p>
        <div className="flex w-5/6 mx-auto brutalborder mt-4">
          <text
            type="text"
            id="myInput"
            className="p-2 w-11/12 bg-black text-white flex items-center text-lg"
          >
            todo: link and copy function
          </text>

          <div className="tooltip block p-2">
            <button className="text-base font-bold border-none bg-white">
              <span className="tooltiptext inline" id="myTooltip">
                COPY
                <img src={clipboard_svg.src} className="h-6 " alt="clipboard" />
              </span>
            </button>
          </div>
          <div className="block border-l-2 border-black p-2 lg:hidden">
            <button className="ml-2 fill-black inline-block ">
              <div className="text-base font-bold "> SHARE</div>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
                className="w-6 h-6 mx-auto"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z"
                />
              </svg>
            </button>
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
