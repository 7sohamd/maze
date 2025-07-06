import '@/styles/globals.css'
import type { AppProps } from 'next/app'

declare global {
  interface Window {
    petra?: any;
  }
}

export default function App({ Component, pageProps }: AppProps) {
  const connectPetra = async () => {
    if (typeof window !== 'undefined' && window.petra) {
      try {
        const response = await window.petra.connect();
        const address = response.address;
        // Use address as needed
      } catch (e) {
        alert("Failed to connect Petra");
      }
    } else {
      alert("Petra wallet not found");
    }
  };

  return <Component {...pageProps} />
} 