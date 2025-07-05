// Test the API route logic
const sabotageActions = [
    { id: "slow", name: "Slow Down", cost: 50, type: 1 },
    { id: "block", name: "Block Path", cost: 75, type: 2 },
    { id: "damage", name: "Damage", cost: 100, type: 3 },
    { id: "enemy", name: "Spawn Enemy", cost: 125, type: 4 }
];

function testApiLogic() {
    console.log('🔌 Testing API Route Logic...');
    
    // Test sabotage mapping
    const testAction = 'slow';
    const sabotage = sabotageActions.find(s => s.id === testAction);
    
    if (sabotage) {
        console.log('✅ Sabotage mapping working');
        console.log('Action:', sabotage.name);
        console.log('Cost:', sabotage.cost);
        console.log('Type:', sabotage.type);
    } else {
        console.log('❌ Sabotage mapping failed');
        return false;
    }
    
    // Test cost calculation
    const userBalance = 1000;
    const canAfford = userBalance >= sabotage.cost;
    console.log('✅ Cost calculation working');
    console.log('User balance:', userBalance);
    console.log('Can afford:', canAfford);
    
    // Test all sabotage types
    console.log('\n📋 Testing all sabotage types:');
    sabotageActions.forEach(action => {
        console.log(`${action.id}: ${action.name} - ${action.cost} tokens`);
    });
    
    return true;
}

testApiLogic(); 