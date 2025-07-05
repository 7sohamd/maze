import { useState, useEffect, useCallback } from 'react';

export function isValidAptosAddress(addr: string) {
  return /^0x[a-fA-F0-9]{64}$/.test(addr);
}

export function usePetraWallet() {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
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

  // Connect to Petra
  const connect = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (typeof window === 'undefined' || !(window as any).aptos) {
        setError('Petra wallet not found. Make sure the extension is installed, enabled, and this page is not in incognito mode.');
        setLoading(false);
        return;
      }
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
    setBalance(null);
    setLoading(false);
  }, []);

  // Fetch APT balance
  const fetchBalance = useCallback(async (addr: string) => {
    if (!isValidAptosAddress(addr)) {
      console.error('Invalid Aptos address:', addr);
      setBalance(null);
      return;
    }
    try {
      console.log('Fetching balance for', addr);
      // Try fullnode first
      const res = await fetch(`https://fullnode.testnet.aptoslabs.com/v1/accounts/${addr}/resources`);
      const data = await res.json();
      console.log('Resources:', data);
      const coin = data.find((r: any) => r.type === '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>');
      if (coin) {
        console.log('CoinStore found (fullnode):', coin);
        setBalance(Number(coin.data.coin.value) / 1e8); // APT has 8 decimals
        return;
      } else {
        console.log('CoinStore not found on fullnode, trying /api/aptos-balance proxy...');
        // Fallback: try backend proxy
        const explorerRes = await fetch(`/api/aptos-balance?address=${addr}`);
        const explorerData = await explorerRes.json();
        console.log('Proxy API:', explorerData);
        if (explorerData && explorerData.balance) {
          setBalance(Number(explorerData.balance) / 1e8);
          return;
        }
        setBalance(0);
      }
    } catch (e) {
      console.error('Error fetching balance:', e);
      setBalance(null);
    }
  }, []);

  // Update balance when address changes
  useEffect(() => {
    if (address) {
      fetchBalance(address);
    }
  }, [address, fetchBalance]);

  // Expose signAndSubmitTransaction
  const signAndSubmitTransaction = useCallback(async (payload: any) => {
    if (typeof window === 'undefined' || !(window as any).aptos) throw new Error('Petra wallet not found');
    return (window as any).aptos.signAndSubmitTransaction(payload);
  }, []);

  return {
    isConnected,
    address,
    balance,
    loading,
    error,
    connect,
    disconnect,
    signAndSubmitTransaction,
    fetchBalance,
  };
} 