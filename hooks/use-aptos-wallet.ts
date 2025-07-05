import { useState, useEffect, useCallback } from 'react';
import { MazeGameClient, createAptosAccount, getCurrentTimestamp } from '@/lib/aptos-client';

interface WalletState {
  isConnected: boolean;
  address: string | null;
  balance: number;
  cooldowns: {
    slow: number;
    block: number;
    damage: number;
    enemy: number;
  };
  loading: boolean;
  error: string | null;
}

export function useAptosWallet() {
  const [walletState, setWalletState] = useState<WalletState>({
    isConnected: false,
    address: null,
    balance: 0,
    cooldowns: {
      slow: 0,
      block: 0,
      damage: 0,
      enemy: 0,
    },
    loading: false,
    error: null,
  });

  const [client] = useState(() => new MazeGameClient("https://fullnode.testnet.aptoslabs.com"));

  // Connect wallet (for demo, creates a new account)
  const connectWallet = useCallback(async () => {
    setWalletState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const account = createAptosAccount();
      const address = account.address().toString();
      
      // For testing without deployed contract, simulate initialization
      console.log('Creating wallet for testing (contract not deployed yet)');
      
      // Simulate initial balance and cooldowns for testing
      const balance = 1000; // Starting tokens
      const currentTimestamp = getCurrentTimestamp();
      const remainingCooldowns = {
        slow: 0,
        block: 0,
        damage: 0,
        enemy: 0,
      };

      setWalletState({
        isConnected: true,
        address,
        balance,
        cooldowns: remainingCooldowns,
        loading: false,
        error: null,
      });

      // Store account info in localStorage for persistence
      localStorage.setItem('aptosAccount', JSON.stringify({
        address,
        privateKey: account.privateKeyHex,
      }));

      console.log('Wallet connected successfully for testing');

    } catch (error: any) {
      console.error('Wallet connection error:', error);
      setWalletState(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to connect wallet',
      }));
    }
  }, [client]);

  // Disconnect wallet
  const disconnectWallet = useCallback(() => {
    setWalletState({
      isConnected: false,
      address: null,
      balance: 0,
      cooldowns: {
        slow: 0,
        block: 0,
        damage: 0,
        enemy: 0,
      },
      loading: false,
      error: null,
    });
    localStorage.removeItem('aptosAccount');
  }, []);

  // Execute sabotage
  const executeSabotage = useCallback(async (sabotageType: string, roomId: string, playerAddress?: string) => {
    if (!walletState.isConnected || !walletState.address) {
      throw new Error('Wallet not connected');
    }

    setWalletState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // For testing without deployed contract, simulate sabotage
      console.log('Executing sabotage for testing (contract not deployed yet)');
      
      // Simulate sabotage costs
      const sabotageCosts = {
        slow: 50,
        block: 75,
        damage: 100,
        enemy: 125,
      };
      
      const cost = sabotageCosts[sabotageType as keyof typeof sabotageCosts] || 50;
      
      // Check if user has enough tokens
      if (walletState.balance < cost) {
        throw new Error(`Insufficient tokens. Need ${cost}, have ${walletState.balance}`);
      }
      
      // Simulate transfer to player (80% of cost)
      const transferAmount = Math.floor(cost * 0.8);
      
      // Simulate new balance after sabotage
      const newBalance = walletState.balance - cost;
      
      // Update wallet state
      setWalletState(prev => ({
        ...prev,
        balance: newBalance,
        loading: false,
      }));

      console.log(`Sabotage executed: ${sabotageType}, cost: ${cost}, transferred to player: ${transferAmount}`);

      return { 
        success: true, 
        transactionHash: 'test-tx-hash-' + Date.now(),
        transferTransactionHash: 'test-transfer-tx-hash-' + Date.now(),
        transferredToPlayer: transferAmount,
      };

    } catch (error: any) {
      setWalletState(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to execute sabotage',
      }));
      throw error;
    }
  }, [walletState.isConnected, walletState.address, walletState.balance]);

  // Refresh wallet data
  const refreshWallet = useCallback(async () => {
    if (!walletState.isConnected || !walletState.address) return;

    try {
      // For testing without deployed contract, simulate refresh
      console.log('Refreshing wallet for testing (contract not deployed yet)');
      
      // Simulate balance and cooldowns for testing
      const balance = 1000; // Keep same balance for testing
      const currentTimestamp = getCurrentTimestamp();
      const remainingCooldowns = {
        slow: 0,
        block: 0,
        damage: 0,
        enemy: 0,
      };

      setWalletState(prev => ({
        ...prev,
        balance,
        cooldowns: remainingCooldowns,
      }));
    } catch (error: any) {
      console.error('Failed to refresh wallet:', error);
    }
  }, [walletState.isConnected, walletState.address, client]);

  // Auto-connect on mount if account exists
  useEffect(() => {
    const storedAccount = localStorage.getItem('aptosAccount');
    if (storedAccount) {
      connectWallet();
    }
  }, [connectWallet]);

  // Auto-refresh cooldowns every second
  useEffect(() => {
    if (!walletState.isConnected) return;

    const interval = setInterval(() => {
      refreshWallet();
    }, 1000);

    return () => clearInterval(interval);
  }, [walletState.isConnected, refreshWallet]);

  return {
    ...walletState,
    connectWallet,
    disconnectWallet,
    executeSabotage,
    refreshWallet,
  };
} 