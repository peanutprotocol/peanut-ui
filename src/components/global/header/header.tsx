"use client";
import Link from "next/link";
import { useWeb3Modal } from "@web3modal/react";
import { useAccount } from "wagmi";

import * as global_components from "@/components/global";
import * as utils from "@/utils";

import peanut_logo from "@/assets/peanutman-logo.svg";
import smiley from "@/assets/smiley.svg";

export function Header() {
  const { address, isConnected } = useAccount();

  const { open } = useWeb3Modal();

  return (
    <div>
      <nav className="relative flex flex-wrap justify-between bg-black max-h-20 mr-4 my-2">
        <div className="flex items-center flex-grow gap-1 sm:gap-4">
          <Link
            className="flex items-center h-full font-bold text-2xl uppercase cursor-pointer hover:bg-white hover:text-black no-underline text-white pl-2 py-2"
            href="/"
          >
            <img src={peanut_logo.src} alt="logo" className="h-10" />
            <span className="hidden lg:inline lg:px-6">peanut protocol</span>
          </Link>
          <Link
            className="flex h-full font-bold items-center uppercase text-base cursor-pointer hover:bg-white hover:text-black no-underline text-white lg:px-8 py-2"
            href={"/about"}
          >
            <span className="">about</span>
          </Link>
          <div
            className="flex h-full font-bold items-center uppercase text-base cursor-pointer hover:bg-white hover:text-black no-underline text-white lg:px-8 py-2"
            onClick={() => {
              window.open(
                "https://peanutprotocol.notion.site/Peanut-Protocol-5776ec3a97de4e5d972ae3f6ba7f4f04"
              );
            }}
          >
            <span className="">docs</span>
          </div>
        </div>
        <div className="flex gap-1 h-full self-center sm:gap-4">
          <Link href={"/dashboard"} className="no-underline">
            <button className="text-center brutalborder cursor-pointer block p-1 sm:py-2 sm:px-4 md:h-max bg-white text-black font-bold text-sm lg:text-lg hover:invert h-full">
              Dashboard
            </button>
          </Link>
          <button
            id="connectButton"
            className="text-center brutalborder cursor-pointer block p-1 sm:py-2 sm:px-4 bg-white text-black font-bold text-sm lg:text-lg hover:invert h-full"
            onClick={open}
          >
            {isConnected ? utils.shortenAddress(address ?? "") : "Connect"}
          </button>
        </div>
      </nav>
      <global_components.MarqueeWrapper
        backgroundColor="bg-fuchsia"
        onClick={() => {
          window.open(
            "https://peanutprotocol.notion.site/Send-Tokens-via-Link-Peanut-Link-SDK-1-0-9a89ea726b754a1c9f7e012125a01a85"
          );
        }}
      >
        <>
          <div className="italic text-center uppercase mr-2 font-black tracking-wide md:text-4xl md:py-4 py-2">
            new sdk
          </div>
          {/* replaced the smiley emoticon with an actual svg, this makes it the same on every device (android, ios, mac, windows ...) */}
          <img src={smiley.src} alt="logo" className=" mr-1 h-5 md:h-8" />
          <div className="italic text-center uppercase mr-2 font-black tracking-wide md:text-4xl md:py-4 py-2">
            click here
          </div>
          <img src={smiley.src} alt="logo" className="h-5 mr-1 md:h-8" />
        </>
      </global_components.MarqueeWrapper>
    </div>
  );
}
