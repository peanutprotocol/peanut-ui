import * as UAuthWeb3Modal from "@uauth/web3modal";
import UAuthSPA from "@uauth/js";
import WalletConnectProvider from "@walletconnect/web3-provider";
import Web3Modal from "web3modal";

export const uauthOptions: UAuthWeb3Modal.IUAuthOptions = {
  clientID: "8691d8bc-ea54-4941-8156-17298153e7fb",
  redirectUri: "http://localhost:3000",
  //redirectUri: window.location.origin,

  // Must include both the openid and wallet scopes.
  scope: "openid wallet profile",
};

const providerOptions = {
  // Currently the package isn't inside the web3modal library. For now,
  // users must use this libary to create a custom web3modal provider.

  // All custom `web3modal` providers must be registered using the "custom-"
  // prefix.
  "custom-uauth": {
    // The UI Assets
    display: UAuthWeb3Modal.display,
    // The Connector
    connector: UAuthWeb3Modal.connector,
    // The SPA libary
    package: UAuthSPA,
    // The SPA libary options
    options: uauthOptions,
  },

  // For full functionality we include the walletconnect provider as well.
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

  // Include any other web3modal providers here
};

const web3modal = new Web3Modal({ providerOptions });

// Register the web3modal so the connector has access to it.
UAuthWeb3Modal.registerWeb3Modal(web3modal);

export default web3modal;
