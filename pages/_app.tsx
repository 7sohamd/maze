import '@/styles/globals.css'
import type { AppProps } from 'next/app'
import { AptosWalletAdapterProvider } from '@aptos-labs/wallet-adapter-react';
import { PetraWallet } from '@aptos-labs/wallet-adapter-petra';

const wallets = [new PetraWallet()];

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AptosWalletAdapterProvider wallets={wallets} autoConnect={false}>
      <Component {...pageProps} />
    </AptosWalletAdapterProvider>
  );
} 