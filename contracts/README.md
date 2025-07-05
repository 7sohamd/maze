# Maze Game Smart Contract

This directory contains the Aptos Move smart contract for the Maze Game, which handles user tokens and sabotage actions on the blockchain.

## Overview

The smart contract provides:
- **Game Tokens**: Users start with 1000 tokens and can earn/spend them
- **Sabotage Actions**: 4 different sabotage types with different costs and cooldowns
- **Cooldown System**: Prevents spam by enforcing cooldown periods
- **Event System**: Tracks all token transactions and game events

## Sabotage Types

| Type | Cost | Cooldown | Description |
|------|------|----------|-------------|
| Slow | 50 tokens | 10 seconds | Reduce player speed by 30% |
| Block | 75 tokens | 15 seconds | Place obstacle near player |
| Damage | 100 tokens | 12 seconds | Reduce player health |
| Enemy | 125 tokens | 20 seconds | Spawn enemy near player |

## Deployment Instructions

### Prerequisites
1. Install Aptos CLI: https://aptos.dev/tools/aptos-cli/
2. Create an Aptos account and get testnet tokens
3. Install Node.js dependencies: `npm install aptos`

### Deploy to Testnet

1. **Initialize Aptos project**:
   ```bash
   cd contracts
   aptos init --profile testnet
   ```

2. **Update Move.toml**:
   Replace `maze_game = "_"` with your actual address:
   ```toml
   [addresses]
   maze_game = "0x1234567890abcdef..." # Your address
   ```

3. **Deploy the contract**:
   ```bash
   aptos move publish --named-addresses maze_game=<your_address> --profile testnet
   ```

4. **Update the client configuration**:
   In `lib/aptos-client.ts`, update the `moduleAddress` to your deployed address.

### Deploy to Mainnet

1. **Switch to mainnet profile**:
   ```bash
   aptos init --profile mainnet
   ```

2. **Deploy with mainnet profile**:
   ```bash
   aptos move publish --named-addresses maze_game=<your_address> --profile mainnet
   ```

## Testing

Run the Move tests:
```bash
aptos move test --named-addresses maze_game=<your_address>
```

## Integration with Frontend

The frontend integrates with the smart contract through:

1. **Aptos Client** (`lib/aptos-client.ts`): TypeScript SDK for blockchain interactions
2. **Wallet Hook** (`hooks/use-aptos-wallet.ts`): React hook for wallet management
3. **API Routes** (`app/api/rooms/[roomId]/sabotage/aptos/route.ts`): Backend integration

### Usage Example

```typescript
import { useAptosWallet } from '@/hooks/use-aptos-wallet';

function GameComponent() {
  const { 
    isConnected, 
    address, 
    balance, 
    cooldowns, 
    connectWallet, 
    executeSabotage 
  } = useAptosWallet();

  const handleSabotage = async () => {
    try {
      await executeSabotage('slow', 'room123');
      console.log('Sabotage executed successfully!');
    } catch (error) {
      console.error('Sabotage failed:', error);
    }
  };

  return (
    <div>
      {!isConnected ? (
        <button onClick={connectWallet}>Connect Wallet</button>
      ) : (
        <div>
          <p>Address: {address}</p>
          <p>Balance: {balance} tokens</p>
          <button onClick={handleSabotage}>Execute Sabotage</button>
        </div>
      )}
    </div>
  );
}
```

## Smart Contract Functions

### Public Functions

- `initialize_account(account: signer)`: Initialize user account with starting tokens
- `get_token_balance(addr: address): u64`: Get user's token balance
- `get_sabotage_cooldowns(addr: address): (u64, u64, u64, u64)`: Get user's cooldowns
- `earn_tokens(account: signer, amount: u64, reason: String)`: Award tokens to user
- `execute_sabotage(account: signer, sabotage_type: u64, room_id: String, current_timestamp: u64)`: Execute sabotage action
- `start_game(room_id: String, timestamp: u64)`: Start a new game
- `end_game(result: String, timestamp: u64)`: End current game
- `get_game_state(): (bool, String, u64)`: Get current game state

### Events

- `TokensEarned`: Emitted when user earns tokens
- `TokensSpent`: Emitted when user spends tokens
- `SabotageExecuted`: Emitted when sabotage is executed
- `GameStarted`: Emitted when game starts
- `GameEnded`: Emitted when game ends

## Security Considerations

1. **Access Control**: Only the account owner can spend their tokens
2. **Cooldown Enforcement**: Prevents spam attacks
3. **Balance Checks**: Ensures sufficient tokens before execution
4. **Input Validation**: Validates sabotage types and parameters

## Gas Optimization

- Uses efficient data structures for cooldowns
- Minimizes storage operations
- Optimized event emission

## Future Enhancements

1. **Token Economics**: Implement token earning mechanisms
2. **Governance**: Add voting for game parameters
3. **NFT Integration**: Add collectible items
4. **Tournament System**: Multi-room competitions
5. **Staking**: Allow users to stake tokens for rewards 