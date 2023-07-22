import * as socketTech from "@socket.tech/socket-v2-sdk";

export const socket = new socketTech.Socket({
  apiKey: process.env.SOCKET_API_KEY ?? "", // add api key here
  defaultQuotePreferences: {
    singleTxOnly: true,
  },
});
