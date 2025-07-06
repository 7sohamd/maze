declare global {
  interface Window {
    petra?: {
      connect(): Promise<{ address: string }>;
      disconnect(): Promise<void>;
      isConnected(): Promise<boolean>;
      account(): Promise<{ address: string }>;
      signAndSubmitTransaction(transaction: any): Promise<any>;
    };
  }
}

export {}; 