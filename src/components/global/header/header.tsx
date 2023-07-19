"use client";
import Link from "next/link";
import { useWeb3Modal } from "@web3modal/react";
import { useAccount } from "wagmi";

import * as global_components from "@/components/global";
import * as utils from "@/utils";
import peanut_logo from "@/assets/peanutman-logo.svg";
import smiley from "@/assets/black-smiling-face.png";

export function Header() {
  const { address, isConnected } = useAccount();

  const { open } = useWeb3Modal();

  return (
    <div>
      <nav className="relative flex flex-wrap justify-between bg-black max-h-20 mr-4">
        <div className="w-full relative flex justify-between lg:w-auto lg:justify-start items-center ">
          <Link
            className="flex items-center h-full font-bold text-2xl uppercase cursor-pointer hover:bg-white hover:text-black px-2 no-underline text-white"
            href="/"
          >
            <img src={peanut_logo.src} alt="logo" className="h-10" />
            <span className="hidden lg:inline lg:px-6">peanut protocol</span>
          </Link>
          <Link
            className="flex h-full font-bold items-center px-8 uppercase text-base cursor-pointer hover:bg-white hover:text-black no-underline text-white"
            href={"/about"}
          >
            <span className="">about</span>
          </Link>
          <div
            className="flex h-full font-bold items-center  px-8 uppercase text-base cursor-pointer hover:bg-white hover:text-black no-underline text-white"
            onClick={() => {
              window.open(
                "https://peanutprotocol.notion.site/Peanut-Protocol-5776ec3a97de4e5d972ae3f6ba7f4f04"
              );
            }}
          >
            <span className="">docs</span>
          </div>
        </div>
        <div className="lg:flex flex-grow items-center ">
          <ul className="flex flex-col gap-5 lg:flex-row list-none lg:ml-auto">
            <li className="nav-item">
              <Link href={"/dashboard"} className="no-underline">
                <button className="text-center brutalborder cursor-pointer block p-1 sm:py-2 sm:px-4 bg-white text-black font-bold text-sm lg:text-lg hover:invert">
                  Dashboard
                </button>
              </Link>
            </li>
            <li className="nav-item">
              <button
                id="connectButton"
                className="text-center brutalborder cursor-pointer block p-1 sm:py-2 sm:px-4 bg-white text-black font-bold text-sm lg:text-lg hover:invert"
                onClick={open}
              >
                {isConnected ? utils.shortenAddress(address ?? "") : "Connect"}
              </button>
            </li>
          </ul>
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
        {" "}
        <>
          {" "}
          <h1 className="italic text-center uppercase mr-2">new sdk</h1>
          {/* replaced the smiley emoticon with an actual svg, this makes it the same on every device (android, ios, mac, windows ...) */}
          <img src={smiley.src} alt="logo" className="h-8 mr-1" />
          <h1 className="italic text-center uppercase mr-2">click here</h1>
          <img src={smiley.src} alt="logo" className="h-8 mr-1" />
        </>
      </global_components.MarqueeWrapper>
    </div>
  );
}
