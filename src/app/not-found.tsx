"use client";
import "@/styles/globals.css";
import * as global_components from "@/components/global";
import { Inter } from "next/font/google";
import Link from "next/link";
import peanutman_sad from "@/assets/peanutman-sad.svg";
import { Web3Modal } from "@web3modal/react";
import { WagmiConfig } from "wagmi";
import * as config from "@/config";

const inter = Inter({ subsets: ["latin"] });

export default function NotFound() {
  return (
    <div className={inter.className}>
      <WagmiConfig config={config.wagmiConfig}>
        <global_components.PageWrapper bgColor="bg-red">
          <div className="flex relative flex-col px-16 md:px-32 mt-64  justify-center h-full items-start font-light italic gap-2 md:gap-0">
            <h4 className="leading-none m-0 text-sm sm:text-base md:text-lg lg:text-xl">
              Hey there! Sorrrry.
            </h4>
            <h1 className="leading-none m-0 text-2xl md:text-4xl lg:text-6xl xl:text-8xl font-bold truncate">
              404: Not Found.
            </h1>
            <button
              className="block w-full px-2 sm:w-2/5 lg:w-1/2 p-5 my-4 mb-4 font-black text-2xl cursor-pointer bg-white"
              id="cta-btn"
            >
              Try Beta
            </button>
            <div className="text-sm lg:text-lg">
              Hit us up on{" "}
              <Link className="text-white" href={""}>
                Discord
              </Link>
              !
            </div>
            <img
              src={peanutman_sad.src}
              // className="w-1/3 scale-100 absolute z-index-100 -bottom-24 -left-8 sm:-bottom-24 sm:-left-16 md:-bottom-32 md:-left-32 2xl:-bottom-48 2xl:-left-64"
              className="w-1/2 sm:w-2/5 scale-100 absolute z-index-100 -bottom-64 left-0 sm:left-auto sm:right-16 sm:-bottom-32 -top-32 "
              id="peanutman-presenting"
            />
          </div>
        </global_components.PageWrapper>
      </WagmiConfig>
      <Web3Modal
        projectId={process.env.WC_PROJECT_ID ?? ""}
        ethereumClient={config.ethereumClient}
        themeMode="dark"
        themeVariables={{
          "--w3m-accent-color": "#F1F333", // accent color of the wc modal (text and logo ie) change to whatever you think looks good
          "--w3m-background-color": "#F1F333", //top color of the wc modal, change to whatever you think looks good
        }}
      />
    </div>
  );
}
