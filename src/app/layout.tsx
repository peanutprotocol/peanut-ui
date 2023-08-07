"use client";
import "@/styles/globals.css";
import { Inter } from "next/font/google";
import { Web3Modal } from "@web3modal/react";
import { WagmiConfig } from "wagmi";

import * as config from "@/config";
import { Store } from "@/store/store";
import { useState, useEffect } from "react";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);

  //this useEffect is needed to prevent hydration error when autoConnect in wagmiConfig is true
  useEffect(() => {
    setReady(true);
  }, []);

  return (
    <html lang="en">
      <body className={inter.className}>
        {ready && (
          <WagmiConfig config={config.wagmiConfig}>
            <Store>{children}</Store>
          </WagmiConfig>
        )}
        <Web3Modal
          projectId={process.env.WC_PROJECT_ID ?? ""}
          ethereumClient={config.ethereumClient}
          themeMode="dark"
          themeVariables={{
            "--w3m-accent-color": "#F1F333", // accent color of the wc modal (text and logo ie) change to whatever you think looks good
            "--w3m-background-color": "#F1F333", //top color of the wc modal, change to whatever you think looks good
          }}
        />
      </body>
    </html>
  );
}
