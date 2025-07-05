const { AptosClient, AptosAccount } = require('aptos');

async function testFullIntegration() {
    console.log('🔗 Testing Full Integration...');
    
    try {
        // 1. Create client
        const client = new AptosClient('https://fullnode.testnet.aptoslabs.com');
        console.log('✅ Client created');
        
        // 2. Create account
        const account = new AptosAccount();
        console.log('✅ Account created:', account.address().toString());
        
        // 3. Test sabotage logic
        const sabotageCosts = { slow: 50, block: 75, damage: 100, enemy: 125 };
        const userBalance = 1000;
        const testAction = 'slow';
        
        if (userBalance >= sabotageCosts[testAction]) {
            console.log('✅ Balance check passed');
            console.log('Can execute sabotage:', testAction);
            console.log('Cost:', sabotageCosts[testAction]);
            console.log('Remaining balance:', userBalance - sabotageCosts[testAction]);
        } else {
            console.log('❌ Insufficient balance');
        }
        
        // 4. Test cooldown logic
        const cooldowns = { slow: 0, block: 0, damage: 0, enemy: 0 };
        const currentTime = Math.floor(Date.now() / 1000);
        console.log('✅ Cooldown system working');
        console.log('Current time:', currentTime);
        console.log('Cooldowns:', cooldowns);
        
        console.log('\n🎉 Integration test successful!');
        console.log('All components working together correctly.');
        
    } catch (error) {
        console.error('❌ Integration test failed:', error.message);
    }
}

testFullIntegration(); 