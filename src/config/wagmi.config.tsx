import { configureChains, createConfig } from "wagmi";
import {
  EthereumClient,
  w3mConnectors,
  w3mProvider,
} from "@web3modal/ethereum";

import * as consts from "@/consts";

const { publicClient } = configureChains(consts.chains, [
  w3mProvider({ projectId: process.env.WC_PROJECT_ID ?? "" }),
]);

export const wagmiConfig = createConfig({
  autoConnect: false, //TODO: look into hydration error when true
  connectors: w3mConnectors({
    projectId: process.env.WC_PROJECT_ID ?? "",
    chains: consts.chains,
  }),
  publicClient,
});

export const ethereumClient = new EthereumClient(wagmiConfig, consts.chains);
