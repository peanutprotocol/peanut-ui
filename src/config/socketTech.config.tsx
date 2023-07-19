import * as socketTech from "@socket.tech/socket-v2-sdk";

export const socket = new socketTech.Socket({
  apiKey: "72a5b4b0-e727-48be-8aa1-5da9d62fe635", // add api key here
  defaultQuotePreferences: {
    singleTxOnly: true,
  },
});
