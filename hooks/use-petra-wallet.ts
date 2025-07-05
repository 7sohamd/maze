import { useWallet } from '@aptos-labs/wallet-adapter-react';

export function isValidAptosAddress(addr: string) {
  return /^0x[a-fA-F0-9]{64}$/.test(addr);
}

export function usePetraWallet() {
  const { connect, disconnect, account, connected, signAndSubmitTransaction } = useWallet();
  return {
    isConnected: connected,
    address: account?.address?.toString() ?? null,
    connect,
    disconnect,
    signAndSubmitTransaction,
  };
} 