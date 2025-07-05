import { useState, useEffect } from 'react';

export function isValidAptosAddress(addr: string) {
  return /^0x[a-fA-F0-9]{64}$/.test(addr);
}

export function usePetraWallet() {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  const isPetraAvailable = isClient && typeof window !== 'undefined' && window.petra;

  const connect = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('Attempting to connect wallet...');
      
      if (!isPetraAvailable) {
        throw new Error('Petra wallet extension not found. Please install it from https://petra.app/');
      }

      // Connect using direct Petra API
      const result = await window.petra!.connect();
      console.log('Petra connect result:', result);
      
      if (result.address) {
        setAddress(result.address);
        setIsConnected(true);
        console.log('Wallet connected successfully:', result.address);
      } else {
        throw new Error('Failed to get wallet address');
      }
    } catch (err) {
      console.error('Failed to connect wallet:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect wallet');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const disconnect = async () => {
    try {
      if (isPetraAvailable) {
        await window.petra!.disconnect();
      }
      setIsConnected(false);
      setAddress(null);
      setError(null);
    } catch (err) {
      console.error('Failed to disconnect wallet:', err);
    }
  };

  const signAndSubmitTransaction = async (transaction: any) => {
    if (!isPetraAvailable || !isConnected) {
      throw new Error('Wallet not connected');
    }
    
    try {
      const result = await window.petra!.signAndSubmitTransaction(transaction);
      return result;
    } catch (err) {
      console.error('Failed to sign and submit transaction:', err);
      throw err;
    }
  };

  // Set client flag and check connection status on mount
  useEffect(() => {
    setIsClient(true);
    
    if (isPetraAvailable) {
      window.petra!.isConnected().then((connected: boolean) => {
        if (connected) {
          window.petra!.account().then((account: any) => {
            setAddress(account.address);
            setIsConnected(true);
          }).catch(console.error);
        }
      }).catch(console.error);
    }
  }, [isPetraAvailable]);

  return {
    isConnected,
    address,
    connect,
    disconnect,
    signAndSubmitTransaction,
    loading,
    error,
    isPetraAvailable,
  };
} 