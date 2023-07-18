"use client";
import type UAuthSPA from "@uauth/js";
import * as UAuthWeb3Modal from "@uauth/web3modal";
import React, { useContext, useEffect, useMemo, useState } from "react";
import Web3 from "web3";
import Web3Modal, {
  CLOSE_EVENT,
  CONNECT_EVENT,
  ERROR_EVENT,
  ICoreOptions,
} from "web3modal";

export interface Web3ModalContextValue {
  web3modal: Web3Modal;
  connect: (id?: string) => Promise<void>;
  disconnect: () => Promise<void>;
  networkId?: number;
  chainId?: number;
  provider?: any;
  web3?: Web3;
  address?: string;
  isConnected: boolean;
  isLoading: boolean;
  error?: Error;
  user: any;
  uauth: UAuthSPA;
}

export const Web3ModalContext = React.createContext<Web3ModalContextValue>(
  null as any
);

export interface Web3ModalProviderProps extends Partial<ICoreOptions> {
  onNewWeb3Modal?(web3modal: any): void;
  children: React.ReactNode;
}

export const Web3ModalProvider: React.FC<Web3ModalProviderProps> = ({
  children,
  onNewWeb3Modal,
  ...options
}) => {
  const [networkId, setNetworkId] = useState<number>();
  const [chainId, setChainId] = useState<number>();
  const [provider, setProvider] = useState<any>();
  const [address, setAddress] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error>();
  const [user, setUser] = useState<any>();
  const [web3modal, setWeb3Modal] = useState<Web3Modal>(null as any);

  useEffect(() => {
    const w3m = new Web3Modal(options);
    if (typeof onNewWeb3Modal === "function") {
      onNewWeb3Modal(w3m);
    }
    setWeb3Modal(w3m);
  }, []);

  const web3 = useMemo(() => {
    return provider ? new Web3(provider) : undefined;
  }, [provider]);

  const uauth = useMemo(() => {
    const { package: uauthPackage, options: uauthOptions } =
      options.providerOptions!["custom-uauth"];
    return UAuthWeb3Modal.getUAuth(uauthPackage, uauthOptions);
  }, []);

  const connect = async (id?: string) => {
    setLoading(true);
    setError(undefined);
    try {
      const provider = id
        ? await web3modal.connectTo(id)
        : await web3modal.connect();

      if (web3modal.cachedProvider === "custom-uauth") {
        setUser(await uauth.user());
      }

      setProvider(provider);

      const tempWeb3 = new Web3(provider);

      const [address] = await tempWeb3.eth.getAccounts();
      setAddress(address);

      setChainId(await tempWeb3.eth.getChainId());
      setNetworkId(await tempWeb3.eth.net.getId());

      setError(undefined);
      setLoading(false);
    } catch (e) {
      setError(e as Error);
      setLoading(false);

      console.error("Failed to connect!");
    }
  };

  const disconnect = async () => {
    if (web3modal.cachedProvider === "custom-uauth") {
      web3modal.clearCachedProvider();
      await uauth.logout();
    }

    web3modal.clearCachedProvider();
    unsubscribeFromProvider(provider);
    setProvider(undefined);
    setAddress(undefined);
    setLoading(false);
    setChainId(undefined);
    setNetworkId(undefined);
  };

  // Web3Modal event emitter

  useEffect(() => {
    const onErrorEvent = (error: any) => {
      console.error("web3modal.ERROR_EVENT", error);
      setError(error);
    };

    const onCloseEvent = () => {
      console.log("web3modal.CLOSE_EVENT");
    };

    const onConnectEvent = async (provider: any) => {
      console.log("web3modal.CONNECT_EVENT", provider);
    };

    if (web3modal) {
      web3modal.on(ERROR_EVENT, onErrorEvent);
      web3modal.on(CLOSE_EVENT, onCloseEvent);
      web3modal.on(CONNECT_EVENT, onConnectEvent);
    }

    return () => {
      if (web3modal) {
        web3modal.off(ERROR_EVENT, onErrorEvent);
        web3modal.off(CLOSE_EVENT, onCloseEvent);
        web3modal.off(CONNECT_EVENT, onConnectEvent);
      }
    };
  }, [web3modal]);

  // Provider event emitter

  const onClose = () => {
    setProvider(undefined);
    setAddress(undefined);
  };

  const onAccountsChanged = async ([address]: string[]) => {
    setAddress(address);
  };

  const onChainChanged = async (chainId: number) => {
    setChainId(chainId);
    setNetworkId(await web3!.eth.net.getId());
  };

  const onNetworkChanged = async (networkId: number) => {
    setNetworkId(networkId);
    setChainId(await web3!.eth.getChainId());
  };

  const subscribeToProvider = (provider: any) => {
    if (provider == null || typeof provider.on !== "function") {
      return;
    }

    provider.on("close", onClose);
    provider.on("accountsChanged", onAccountsChanged);
    provider.on("chainChanged", onChainChanged);
    provider.on("networkChanged", onNetworkChanged);
  };

  const unsubscribeFromProvider = (provider: any) => {
    if (provider == null || typeof provider.removeListener !== "function") {
      return;
    }

    provider.removeListener("close", onClose);
    provider.removeListener("accountsChanged", onAccountsChanged);
    provider.removeListener("chainChanged", onChainChanged);
    provider.removeListener("networkChanged", onNetworkChanged);
  };

  useEffect(() => {
    subscribeToProvider(provider);
    return () => {
      unsubscribeFromProvider(provider);
    };
  }, [provider]);

  const value: Web3ModalContextValue = {
    web3modal,
    connect,
    disconnect,
    networkId,
    chainId,
    provider,
    web3,
    address,
    isConnected: provider != null,
    isLoading: loading,
    error,
    user,
    uauth,
  };

  return <Web3ModalContext.Provider value={value} children={children} />;
};

export const useWeb3Modal = () => useContext(Web3ModalContext);
