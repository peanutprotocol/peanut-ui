import Link from "next/link";
import { useState } from "react";

import { useWeb3Modal } from "@/context/Web3ModalContext";
import * as consts from "@/consts";

import * as _consts from "../send.consts";

export function SendInitialView({ onNextScreen }: _consts.ISendScreenProps) {
  const [denomination, setDenomination] = useState("USD");
  const { isConnected, connect } = useWeb3Modal();

  return (
    <div className="flex flex-col items-center center-xy py-6 px-4 w-1/2 lg:w-<1>/2 brutalborder bg-white mx-auto mt-5 text-black">
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
      <form className="w-full">
        <div className="flex w-full flex-col gap-5 items-center">
          <div className="flex gap-2">
            <div className="relative w-full lg:max-w-sm">
              <select className="w-full p-2.5 text-black bg-white border rounded-md shadow-sm outline-none focus:border-black">
                {consts.CHAIN_MAP.map((chain) => {
                  return (
                    <option key={chain.name} value={chain.chainId}>
                      {chain.name}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="relative w-full lg:max-w-sm">
              <select className="w-full p-2.5 text-black bg-white border rounded-md shadow-sm outline-none focus:border-black">
                {consts.CHAIN_MAP.map((chain) => {
                  return (
                    <option key={chain.name} value={chain.chainId}>
                      {chain.name}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
          <div className="relative w-3/4 ">
            <div className="absolute inset-y-0 right-0 flex items-center ">
              <span className="cursor-pointertext-lg px-2 ">
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
              required
              name="amount"
              id="amount"
              type="number"
              step="any"
              min="0"
              className="no-spin block w-full py-4 px-2 brutalborder   placeholder:text-lg placeholder:text-black placeholder:font-bold font-bold text-lg outline-none appearance-none "
              placeholder="0.00"
              aria-describedby="price-currency"
            />
          </div>
          <button
            type="button"
            className="block w-4/5 sm:w-2/5 lg:w-1/2 p-5 my-8 mb-4 mx-auto font-black text-2xl cursor-pointer bg-white"
            id="cta-btn"
            onClick={
              isConnected
                ? () => {
                    onNextScreen();
                  }
                : () => {
                    connect();
                  }
            }
          >
            {isConnected ? "Send" : "Connect Wallet"}
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
    </div>
  );
}
