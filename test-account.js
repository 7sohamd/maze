const { AptosAccount } = require('aptos');

function testAccountCreation() {
    try {
        console.log('👤 Testing Account Creation...');
        const account = new AptosAccount();
        console.log('✅ Account created successfully');
        console.log('Address:', account.address().toString());
        console.log('Private Key Length:', account.privateKeyHex.length);
        console.log('Public Key Length:', account.publicKey.hex().length);
        return true;
    } catch (error) {
        console.error('❌ Account creation failed:', error.message);
        return false;
    }
}

testAccountCreation(); 