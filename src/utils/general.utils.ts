import * as interfaces from "@/interfaces";

export const shortenAddress = (address: string) => {
  const firstBit = address.substring(0, 6);
  const endingBit = address.substring(address.length - 4, address.length);

  return firstBit + "..." + endingBit;
};

export function waitForPromise<T>(
  promise: Promise<T>,
  timeoutTime: number = 30000
): Promise<T> {
  return new Promise((resolve, reject) => {
    let timeoutId = setTimeout(() => {
      reject(
        "Timeout: 30 seconds have passed without a response from the promise"
      );
    }, timeoutTime);

    promise
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

export const saveToLocalStorage = (key: string, data: any) => {
  try {
    // Convert the data to a string before storing it in localStorage
    const serializedData = JSON.stringify(data);
    localStorage.setItem(key, serializedData);
  } catch (error) {
    console.error("Error saving to localStorage:", error);
  }
};

export const getFromLocalStorage = (key: string) => {
  try {
    // Retrieve the data from localStorage and parse it back to its original form
    const serializedData = localStorage.getItem(key);
    return serializedData ? JSON.parse(serializedData) : null;
  } catch (error) {
    console.error("Error getting data from localStorage:", error);
    return null;
  }
};

export const getAllLinksFromLocalStorage = ({
  address,
}: {
  address: string;
}) => {
  try {
    const localStorageData: interfaces.ILocalStorageItem[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);

      if (key !== null && key?.includes(address)) {
        const value = localStorage.getItem(key);
        if (value !== null) {
          const x = {
            address: key.split("-")[0].trim(),
            hash: key.split("-")[1].trim(),
            link: value.replaceAll('"', ""),
          };
          localStorageData.push(x);
        }
      }
    }
    return localStorageData;
  } catch (error) {
    console.error("Error getting data from localStorage:", error);
  }
};

export function formatAmountWithDecimals({
  amount,
  decimals,
}: {
  amount: number;
  decimals: number;
}) {
  const divider = 10 ** decimals;
  const formattedAmount = amount / divider;
  return formattedAmount;
}
