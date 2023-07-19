import UAuthSPA from "@uauth/js";
import * as UAuthWeb3Modal from "@uauth/web3modal";
import WalletConnectProvider from "@walletconnect/web3-provider";
import { IProviderOptions } from "web3modal";

export const uauthOptions: UAuthWeb3Modal.IUAuthOptions = {
  clientID: process.env.CLIENT_ID ?? "",
  redirectUri: "http://localhost:3000",
  //redirectUri: window.location.origin,

  // Must include both the openid and wallet scopes.
  scope: "openid wallet profile",
};

const providerOptions: IProviderOptions = {
  "custom-uauth": {
    display: UAuthWeb3Modal.display,
    connector: UAuthWeb3Modal.connector,
    package: UAuthSPA,
    options: uauthOptions,
  },
  walletconnect: {
    package: WalletConnectProvider,
    options: {
      // test key - don't copy as your mileage may vary
      infuraId: process.env.INFURA_ID ?? "",
      rpc: {
        137: "https://polygon-rpc.com/",
        80001: "https://rpc-mumbai.maticvigil.com/",
        10: "https://mainnet.optimism.io/",
        42161: "https://arb1.arbitrum.io/rpc",
      },
      // @dev: add more networks here
    },
  },
  //   fortmatic: {
  //     package: Fortmatic,
  //     options: {
  //       // TESTNET api key
  //       key: "pk_test_391E26A3B43A3350",
  //     },
  //   },
};

export default providerOptions;
