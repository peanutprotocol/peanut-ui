"use client";
import UAuth from "@uauth/js";

import * as UAuthWeb3Modal from "@uauth/web3modal";
import UAuthSPA from "@uauth/js";
import WalletConnectProvider from "@walletconnect/web3-provider";
import Web3Modal from "web3modal";
import { useEffect, useState } from "react";
import Core from "web3modal";

import image from "@/assets/peanutman-logo.svg";
import smiley from "@/assets/black-smiling-face.png";
import * as global_components from "@/components/global";
import Link from "next/link";

export function Header() {
  const [web3modal, setWeb3modal] = useState<Core>();
  const uauth = new UAuth({
    clientID: "8691d8bc-ea54-4941-8156-17298153e7fb",
    //redirectUri: window.location.origin,
    redirectUri: "http://localhost:3000",
    scope: "openid wallet profile",
  });

  const providerOptions = {
    walletconnect: {
      package: WalletConnectProvider,
      options: {
        // test key - don't copy as your mileage may vary
        infuraId: "4478656478ab4945a1b013fb1d8f20fd",
        rpc: {
          137: "https://polygon-rpc.com/",
          80001: "https://rpc-mumbai.maticvigil.com/",
          10: "https://mainnet.optimism.io/",
          42161: "https://arb1.arbitrum.io/rpc",
        },
      },
    },

    "custom-uauth": {
      display: UAuthWeb3Modal.display,
      connector: UAuthWeb3Modal.connector,
      package: UAuthSPA,
      options: uauth,
    },

    //add formatic
  };

  //put in a useEffect because of SSR in nextJS
  useEffect(() => {
    const web3modal = new Web3Modal({ providerOptions });
    setWeb3modal(web3modal);
  }, []);

  const onConnect = async () => {
    if (web3modal) {
      try {
        const provider = await web3modal.connect();

        console.log(provider);
      } catch (error) {
        console.log(error);
      }
    }
  };

  const onDisconnect = () => {};

  return (
    <div>
      <nav className="relative flex flex-wrap justify-between bg-black max-h-20 mr-2">
        <div className="w-full relative flex justify-between lg:w-auto lg:justify-start items-center ">
          <Link
            className="flex items-center h-full font-bold text-2xl uppercase cursor-pointer hover:bg-white hover:text-black px-2 no-underline text-white"
            href="/"
          >
            <img src={image.src} alt="logo" className="h-10" />
            <span className="hidden lg:inline lg:px-6">peanut protocol</span>
          </Link>
          <Link
            className="flex h-full font-bold items-center  px-8  uppercase text-base cursor-pointer hover:bg-white hover:text-black no-underline text-white"
            href={"/about"}
          >
            <span className="">about</span>
          </Link>
          <Link
            className="flex h-full font-bold items-center  px-8 uppercase text-base cursor-pointer hover:bg-white hover:text-black no-underline text-white"
            href={"/docs"}
          >
            <span className="">docs</span>
          </Link>
        </div>
        <div className="lg:flex flex-grow items-center ">
          <ul className="flex flex-col gap-5 lg:flex-row list-none lg:ml-auto">
            <li className="nav-item">
              <button className="text-center brutalborder cursor-pointer block p-1 sm:py-2 sm:px-4 bg-white text-black font-bold text-sm lg:text-lg hover:invert">
                Dashboard
              </button>
            </li>
            <li className="nav-item">
              <button
                id="connectButton"
                className="text-center brutalborder cursor-pointer block p-1 sm:py-2 sm:px-4 bg-white text-black font-bold text-sm lg:text-lg hover:invert"
                onClick={onConnect}
              >
                Connect
              </button>
            </li>
          </ul>
        </div>
      </nav>
      <global_components.MarqueeSdk backgroundColor="bg-fuchsia">
        <h1 className="italic text-center uppercase"> new sdk</h1>
        {/* replaced the smiley emoticon with an actual svg, this makes it the same on every device (android, ios, mac, windows ...) */}
        <img src={smiley.src} alt="logo" className="h-8" />
        <h1 className="italic text-center uppercase">click here </h1>
        <img src={smiley.src} alt="logo" className="h-8" />
      </global_components.MarqueeSdk>
    </div>
  );
}
