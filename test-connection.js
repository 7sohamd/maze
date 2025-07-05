const { AptosClient } = require('aptos');

async function testConnection() {
    try {
        console.log('🔌 Testing Aptos Connection...');
        const client = new AptosClient('https://fullnode.testnet.aptoslabs.com');
        const ledgerInfo = await client.getLedgerInfo();
        console.log('✅ Connected to Aptos testnet');
        console.log('Chain ID:', ledgerInfo.chain_id);
        console.log('Ledger Version:', ledgerInfo.ledger_version);
        console.log('Block Height:', ledgerInfo.ledger_version);
        return true;
    } catch (error) {
        console.error('❌ Connection failed:', error.message);
        return false;
    }
}

testConnection(); 