"use client";
import "@/styles/globals.css";
import { Inter } from "next/font/google";
import { Web3Modal } from "@web3modal/react";
import { WagmiConfig } from "wagmi";

import * as config from "@/config";

const inter = Inter({ subsets: ["latin"] });

// export const metadata: Metadata = {
//   title: "Create Next App",
//   description: "Generated by create next app",
// };
//Move this somewhere else

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <WagmiConfig config={config.wagmiConfig}>{children}</WagmiConfig>
        <Web3Modal
          projectId={process.env.WC_PROJECT_ID ?? ""}
          ethereumClient={config.ethereumClient}
        />
      </body>
    </html>
  );
}
