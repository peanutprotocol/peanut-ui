export const shortenAddress = (address: string) => {
  const firstBit = address.substring(0, 6);
  const endingBit = address.substring(address.length - 4, address.length);

  return firstBit + "..." + endingBit;
};
