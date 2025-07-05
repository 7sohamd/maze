import { useState, useEffect, useCallback } from 'react';

export function isValidAptosAddress(addr: string) {
  return /^0x[a-fA-F0-9]{64}$/.test(addr);
}

export function usePetraWallet() {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check for Petra on mount (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (!(window as any).aptos) {
        setError('Petra wallet not found. Make sure the extension is installed, enabled, and this page is not in incognito mode.');
      } else {
        setError(null);
      }
    }
  }, []);

  // Always disconnect before connecting to force the popup
  const connect = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (typeof window === 'undefined' || !(window as any).aptos) {
        setError('Petra wallet not found. Make sure the extension is installed, enabled, and this page is not in incognito mode.');
        setLoading(false);
        return;
      }
      // Force disconnect first
      await (window as any).aptos.disconnect();
      // Now connect (will always prompt)
      const result = await (window as any).aptos.connect();
      setIsConnected(true);
      setAddress(result.address);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Failed to connect to Petra');
      setLoading(false);
    }
  }, []);

  // Disconnect
  const disconnect = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (typeof window !== 'undefined' && (window as any).aptos) {
        await (window as any).aptos.disconnect();
      }
    } catch {}
    setIsConnected(false);
    setAddress(null);
    setLoading(false);
  }, []);

  // Expose signAndSubmitTransaction
  const signAndSubmitTransaction = useCallback(async (payload: any) => {
    if (typeof window === 'undefined' || !(window as any).aptos) throw new Error('Petra wallet not found');
    return (window as any).aptos.signAndSubmitTransaction({ payload });
  }, []);

  return {
    isConnected,
    address,
    loading,
    error,
    connect,
    disconnect,
    signAndSubmitTransaction,
  };
} 