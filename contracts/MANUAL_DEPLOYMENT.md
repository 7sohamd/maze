# Manual Deployment Guide

This guide will help you deploy the Maze Game smart contract without using the automated deployment script.

## Prerequisites

### 1. Install Aptos CLI

**Option A: Download from GitHub (Recommended)**
1. Go to: https://github.com/aptos-labs/aptos-core/releases
2. Download the latest release for Windows: `aptos-cli-windows-x86_64.zip`
3. Extract the ZIP file
4. Add the extracted folder to your system PATH, or place `aptos.exe` in a folder that's already in your PATH

**Option B: Install via Chocolatey**
```powershell
choco install aptos-cli
```

**Option C: Install via Scoop**
```powershell
scoop install aptos-cli
```

### 2. Verify Installation
```powershell
aptos --version
```

## Manual Deployment Steps

### Step 1: Initialize Aptos Project

```powershell
# Navigate to contracts directory
cd contracts

# Initialize Aptos project
aptos init --profile maze_game_testnet --network testnet
```

### Step 2: Get Testnet Tokens

1. Visit: https://aptoslabs.com/testnet-faucet
2. Enter your account address (shown after initialization)
3. Request testnet tokens

### Step 3: Update Move.toml

Edit `Move.toml` and replace the placeholder address:

```toml
[addresses]
maze_game = "0x1234567890abcdef..." # Your actual address
```

### Step 4: Compile Contract

```powershell
aptos move compile --named-addresses maze_game=<your_address> --profile maze_game_testnet
```

### Step 5: Deploy Contract

```powershell
aptos move publish --named-addresses maze_game=<your_address> --profile maze_game_testnet
```

### Step 6: Update Frontend Configuration

Edit `lib/aptos-client.ts` and update the module address:

```typescript
constructor(nodeUrl: string = "https://fullnode.mainnet.aptoslabs.com", moduleAddress?: string) {
  this.client = new AptosClient(nodeUrl);
  this.moduleAddress = moduleAddress || "0x1234567890abcdef..."; // Your deployed address
  this.moduleName = "maze_game::game_tokens";
}
```

## Quick Start Commands

Here's a complete sequence of commands:

```powershell
# 1. Initialize project
aptos init --profile maze_game_testnet --network testnet

# 2. Get your account address
aptos account list --profile maze_game_testnet

# 3. Update Move.toml with your address
# (Edit the file manually)

# 4. Compile
aptos move compile --named-addresses maze_game=<your_address> --profile maze_game_testnet

# 5. Deploy
aptos move publish --named-addresses maze_game=<your_address> --profile maze_game_testnet

# 6. Test the contract
aptos move test --named-addresses maze_game=<your_address> --profile maze_game_testnet
```

## Troubleshooting

### Common Issues

1. **"Insufficient balance"**
   - Get testnet tokens from the faucet
   - Wait a few minutes for tokens to arrive

2. **"Compilation failed"**
   - Check that your address in Move.toml is correct
   - Ensure you're using the right profile

3. **"Deployment failed"**
   - Verify you have enough APT tokens
   - Check network connectivity

### Getting Help

- Aptos Documentation: https://aptos.dev/
- Aptos Discord: https://discord.gg/aptos
- GitHub Issues: https://github.com/aptos-labs/aptos-core/issues

## Next Steps

After successful deployment:

1. **Update your frontend** to use the new module address
2. **Test the contract functions** using the Aptos Explorer
3. **Integrate with your game** using the provided TypeScript SDK

## Contract Addresses

Once deployed, your contract will be available at:
- **Module**: `<your_address>::maze_game::game_tokens`
- **Explorer**: https://explorer.aptoslabs.com/account/<your_address>?network=testnet 