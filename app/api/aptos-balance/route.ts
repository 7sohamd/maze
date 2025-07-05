import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get('address');
  if (!address) {
    return new Response(JSON.stringify({ error: 'Missing address' }), { status: 400 });
  }
  try {
    const explorerRes = await fetch(`https://explorer-testnet.aptoslabs.com/api/account/${address}`);
    if (!explorerRes.ok) {
      return new Response(JSON.stringify({ error: 'Failed to fetch from explorer', status: explorerRes.status }), { status: 502 });
    }
    const data = await explorerRes.json();
    return new Response(JSON.stringify(data), { status: 200 });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: 'Failed to fetch from explorer', details: e.message }), { status: 500 });
  }
} 