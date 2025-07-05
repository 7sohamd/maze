import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { address } = req.query;
  if (!address || typeof address !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid address' });
  }
  try {
    const explorerRes = await fetch(`https://explorer-testnet.aptoslabs.com/api/account/${address}`);
    if (!explorerRes.ok) {
      return res.status(502).json({ error: 'Failed to fetch from explorer', status: explorerRes.status });
    }
    const data = await explorerRes.json();
    res.status(200).json(data);
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to fetch from explorer', details: e.message });
  }
} 