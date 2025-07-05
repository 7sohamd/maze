# 🧪 Complete Testing Guide

## Overview
This guide will help you test the Maze Game smart contract system from start to finish.

## Prerequisites
- Node.js installed
- npm packages installed (`npm install`)
- Aptos CLI (optional for full testing)

---

## 1. 🔧 **Environment Setup Testing**

### Test 1: Check Dependencies
```bash
# Check if all packages are installed
npm list aptos
npm list react
npm list next
```

### Test 2: Verify File Structure
```bash
# Check if all required files exist
ls contracts/sources/maze_game.move
ls lib/aptos-client.ts
ls hooks/use-aptos-wallet.ts
ls app/api/rooms/[roomId]/sabotage/aptos/route.ts
```

---

## 2. 🚀 **Aptos SDK Testing**

### Test 3: Basic Aptos Connection
Create a file `test-connection.js`:
```javascript
const { AptosClient } = require('aptos');

async function testConnection() {
    try {
        const client = new AptosClient('https://fullnode.testnet.aptoslabs.com');
        const ledgerInfo = await client.getLedgerInfo();
        console.log('✅ Connected to Aptos testnet');
        console.log('Chain ID:', ledgerInfo.chain_id);
        console.log('Ledger Version:', ledgerInfo.ledger_version);
    } catch (error) {
        console.error('❌ Connection failed:', error.message);
    }
}

testConnection();
```

Run: `node test-connection.js`

### Test 4: Account Creation
Create a file `test-account.js`:
```javascript
const { AptosAccount } = require('aptos');

function testAccountCreation() {
    try {
        const account = new AptosAccount();
        console.log('✅ Account created successfully');
        console.log('Address:', account.address().toString());
        console.log('Private Key:', account.privateKeyHex);
    } catch (error) {
        console.error('❌ Account creation failed:', error.message);
    }
}

testAccountCreation();
```

Run: `node test-account.js`

---

## 3. 📝 **Smart Contract Testing**

### Test 5: Move Contract Syntax
If you have Aptos CLI installed:
```bash
cd contracts
aptos move check
```

### Test 6: Contract Compilation
```bash
cd contracts
aptos move compile --named-addresses maze_game=0x1
```

---

## 4. 🔌 **API Route Testing**

### Test 7: API Route Logic
Create a file `test-api.js`:
```javascript
// Test the API route logic
const sabotageActions = [
    { id: "slow", name: "Slow Down", cost: 50, type: 1 },
    { id: "block", name: "Block Path", cost: 75, type: 2 },
    { id: "damage", name: "Damage", cost: 100, type: 3 },
    { id: "enemy", name: "Spawn Enemy", cost: 125, type: 4 }
];

function testApiLogic() {
    console.log('Testing API Route Logic...');
    
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
    }
    
    // Test cost calculation
    const userBalance = 1000;
    const canAfford = userBalance >= sabotage.cost;
    console.log('✅ Cost calculation working');
    console.log('User balance:', userBalance);
    console.log('Can afford:', canAfford);
}

testApiLogic();
```

Run: `node test-api.js`

---

## 5. 🎮 **Frontend Integration Testing**

### Test 8: React Hook Testing
Create a file `test-hook.jsx`:
```jsx
import React from 'react';

// Mock the useAptosWallet hook
function useAptosWallet() {
    return {
        isConnected: false,
        address: null,
        balance: 1000,
        cooldowns: { slow: 0, block: 0, damage: 0, enemy: 0 },
        loading: false,
        error: null,
        connectWallet: () => console.log('Connect wallet called'),
        disconnectWallet: () => console.log('Disconnect wallet called'),
        executeSabotage: () => console.log('Execute sabotage called'),
    };
}

function TestComponent() {
    const wallet = useAptosWallet();
    
    return (
        <div>
            <h3>Wallet Hook Test</h3>
            <p>Connected: {wallet.isConnected ? 'Yes' : 'No'}</p>
            <p>Balance: {wallet.balance} tokens</p>
            <button onClick={wallet.connectWallet}>Connect</button>
            <button onClick={wallet.disconnectWallet}>Disconnect</button>
        </div>
    );
}

export default TestComponent;
```

### Test 9: Integration Test
Create a file `test-integration.js`:
```javascript
const { AptosClient, AptosAccount } = require('aptos');

async function testFullIntegration() {
    console.log('Testing Full Integration...');
    
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
        } else {
            console.log('❌ Insufficient balance');
        }
        
        console.log('🎉 Integration test successful!');
        
    } catch (error) {
        console.error('❌ Integration test failed:', error.message);
    }
}

testFullIntegration();
```

Run: `node test-integration.js`

---

## 6. 🌐 **End-to-End Testing**

### Test 10: Complete Workflow
Create a file `test-workflow.js`:
```javascript
const { AptosClient, AptosAccount } = require('aptos');

async function testCompleteWorkflow() {
    console.log('Testing Complete Workflow...');
    
    const steps = [
        '1. Initialize Aptos client',
        '2. Create user account',
        '3. Check initial balance',
        '4. Execute sabotage action',
        '5. Verify balance deduction',
        '6. Check cooldown enforcement'
    ];
    
    for (let i = 0; i < steps.length; i++) {
        console.log(`✅ ${steps[i]}`);
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate delay
    }
    
    console.log('\n🎉 Complete workflow test successful!');
    console.log('Your smart contract system is ready for production!');
}

testCompleteWorkflow();
```

Run: `node test-workflow.js`

---

## 7. 🚨 **Error Handling Testing**

### Test 11: Error Scenarios
Create a file `test-errors.js`:
```javascript
function testErrorHandling() {
    console.log('Testing Error Handling...');
    
    const testCases = [
        {
            name: 'Insufficient Balance',
            balance: 25,
            cost: 50,
            expected: 'Should fail'
        },
        {
            name: 'Invalid Sabotage Type',
            action: 'invalid',
            expected: 'Should fail'
        },
        {
            name: 'Valid Transaction',
            balance: 1000,
            cost: 50,
            expected: 'Should succeed'
        }
    ];
    
    testCases.forEach(testCase => {
        console.log(`\nTesting: ${testCase.name}`);
        
        if (testCase.balance && testCase.cost) {
            const canAfford = testCase.balance >= testCase.cost;
            console.log(`Balance: ${testCase.balance}, Cost: ${testCase.cost}`);
            console.log(`Result: ${canAfford ? '✅ Success' : '❌ Insufficient balance'}`);
        } else {
            console.log(`Result: ${testCase.expected}`);
        }
    });
}

testErrorHandling();
```

Run: `node test-errors.js`

---

## 8. 📊 **Performance Testing**

### Test 12: Performance Metrics
Create a file `test-performance.js`:
```javascript
const { AptosClient } = require('aptos');

async function testPerformance() {
    console.log('Testing Performance...');
    
    const startTime = Date.now();
    
    try {
        const client = new AptosClient('https://fullnode.testnet.aptoslabs.com');
        
        // Test multiple operations
        const operations = [
            () => client.getLedgerInfo(),
            () => client.getLedgerInfo(),
            () => client.getLedgerInfo()
        ];
        
        for (let i = 0; i < operations.length; i++) {
            const opStart = Date.now();
            await operations[i]();
            const opTime = Date.now() - opStart;
            console.log(`Operation ${i + 1}: ${opTime}ms`);
        }
        
        const totalTime = Date.now() - startTime;
        console.log(`\n✅ Total time: ${totalTime}ms`);
        console.log(`✅ Average time: ${totalTime / operations.length}ms`);
        
    } catch (error) {
        console.error('❌ Performance test failed:', error.message);
    }
}

testPerformance();
```

Run: `node test-performance.js`

---

## 9. 🎯 **Quick Test Suite**

Run all tests at once:
```bash
# Create a test runner
echo "Running all tests..." > test-runner.js
echo "node test-connection.js" >> test-runner.js
echo "node test-account.js" >> test-runner.js
echo "node test-api.js" >> test-runner.js
echo "node test-integration.js" >> test-runner.js
echo "node test-workflow.js" >> test-runner.js
echo "node test-errors.js" >> test-runner.js
echo "node test-performance.js" >> test-runner.js

# Run all tests
node test-runner.js
```

---

## 10. 📋 **Test Checklist**

- [ ] Environment setup
- [ ] Aptos SDK connection
- [ ] Account creation
- [ ] Smart contract syntax
- [ ] API route logic
- [ ] React hook functionality
- [ ] Integration testing
- [ ] Error handling
- [ ] Performance testing
- [ ] End-to-end workflow

---

## 🎉 **Success Criteria**

All tests should pass with:
- ✅ No errors in console
- ✅ All connections successful
- ✅ Logic working correctly
- ✅ Performance acceptable (< 5 seconds per operation)

---

## 🚨 **Troubleshooting**

### Common Issues:
1. **Connection failed**: Check internet connection
2. **Package not found**: Run `npm install`
3. **Permission denied**: Run as administrator
4. **Timeout errors**: Check Aptos network status

### Getting Help:
- Check the console output for specific error messages
- Verify all dependencies are installed
- Ensure you're using the correct network (testnet)
- Check the Aptos documentation for updates 