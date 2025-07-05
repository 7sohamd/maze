import { AptosClient, AptosAccount, TxnBuilderTypes, BCS, MaybeHexString } from "aptos";

export class MazeGameClient {
  private client: AptosClient;
  private moduleAddress: string;
  private moduleName: string;

  constructor(nodeUrl: string = "https://fullnode.mainnet.aptoslabs.com", moduleAddress?: string) {
    this.client = new AptosClient(nodeUrl);
    this.moduleAddress = moduleAddress || "0x1"; // Default to 0x1 for testing
    this.moduleName = "maze_game::game_tokens";
  }

  // Initialize user account
  async initializeAccount(account: AptosAccount): Promise<string> {
    const payload = {
      function: `${this.moduleAddress}::${this.moduleName}::initialize_account`,
      type_arguments: [],
      arguments: [],
    };

    const txnRequest = await this.client.generateTransaction(account.address(), payload);
    const signedTxn = await this.client.signTransaction(account, txnRequest);
    const txnResult = await this.client.submitTransaction(signedTxn);
    await this.client.waitForTransaction(txnResult.hash);

    return txnResult.hash;
  }

  // Get user's token balance
  async getTokenBalance(userAddress: string): Promise<number> {
    const payload = {
      function: `${this.moduleAddress}::${this.moduleName}::get_token_balance`,
      type_arguments: [],
      arguments: [userAddress],
    };

    const response = await this.client.view(payload);
    return Number(response[0]);
  }

  // Get user's sabotage cooldowns
  async getSabotageCooldowns(userAddress: string): Promise<{
    slow: number;
    block: number;
    damage: number;
    enemy: number;
  }> {
    const payload = {
      function: `${this.moduleAddress}::${this.moduleName}::get_sabotage_cooldowns`,
      type_arguments: [],
      arguments: [userAddress],
    };

    const response = await this.client.view(payload);
    return {
      slow: Number(response[0]),
      block: Number(response[1]),
      damage: Number(response[2]),
      enemy: Number(response[3]),
    };
  }

  // Execute sabotage action
  async executeSabotage(
    account: AptosAccount,
    sabotageType: number,
    roomId: string,
    currentTimestamp: number
  ): Promise<string> {
    const payload = {
      function: `${this.moduleAddress}::${this.moduleName}::execute_sabotage`,
      type_arguments: [],
      arguments: [sabotageType, roomId, currentTimestamp.toString()],
    };

    const txnRequest = await this.client.generateTransaction(account.address(), payload);
    const signedTxn = await this.client.signTransaction(account, txnRequest);
    const txnResult = await this.client.submitTransaction(signedTxn);
    await this.client.waitForTransaction(txnResult.hash);

    return txnResult.hash;
  }

  // Earn tokens
  async earnTokens(account: AptosAccount, amount: number, reason: string): Promise<string> {
    const payload = {
      function: `${this.moduleAddress}::${this.moduleName}::earn_tokens`,
      type_arguments: [],
      arguments: [amount.toString(), reason],
    };

    const txnRequest = await this.client.generateTransaction(account.address(), payload);
    const signedTxn = await this.client.signTransaction(account, txnRequest);
    const txnResult = await this.client.submitTransaction(signedTxn);
    await this.client.waitForTransaction(txnResult.hash);

    return txnResult.hash;
  }

  // Transfer tokens to another user
  async transferTokens(
    fromAccount: AptosAccount,
    toAddress: string,
    amount: number,
    reason: string
  ): Promise<string> {
    const payload = {
      function: `${this.moduleAddress}::${this.moduleName}::transfer_tokens`,
      type_arguments: [],
      arguments: [toAddress, amount.toString(), reason],
    };

    const txnRequest = await this.client.generateTransaction(fromAccount.address(), payload);
    const signedTxn = await this.client.signTransaction(fromAccount, txnRequest);
    const txnResult = await this.client.submitTransaction(signedTxn);
    await this.client.waitForTransaction(txnResult.hash);

    return txnResult.hash;
  }

  // Start a new game
  async startGame(account: AptosAccount, roomId: string, timestamp: number): Promise<string> {
    const payload = {
      function: `${this.moduleAddress}::${this.moduleName}::start_game`,
      type_arguments: [],
      arguments: [roomId, timestamp.toString()],
    };

    const txnRequest = await this.client.generateTransaction(account.address(), payload);
    const signedTxn = await this.client.signTransaction(account, txnRequest);
    const txnResult = await this.client.submitTransaction(signedTxn);
    await this.client.waitForTransaction(txnResult.hash);

    return txnResult.hash;
  }

  // End current game
  async endGame(account: AptosAccount, result: string, timestamp: number): Promise<string> {
    const payload = {
      function: `${this.moduleAddress}::${this.moduleName}::end_game`,
      type_arguments: [],
      arguments: [result, timestamp.toString()],
    };

    const txnRequest = await this.client.generateTransaction(account.address(), payload);
    const signedTxn = await this.client.signTransaction(account, txnRequest);
    const txnResult = await this.client.submitTransaction(signedTxn);
    await this.client.waitForTransaction(txnResult.hash);

    return txnResult.hash;
  }

  // Get current game state
  async getGameState(): Promise<{
    isActive: boolean;
    currentRoom: string;
    lastUpdated: number;
  }> {
    const payload = {
      function: `${this.moduleAddress}::${this.moduleName}::get_game_state`,
      type_arguments: [],
      arguments: [],
    };

    const response = await this.client.view(payload);
    return {
      isActive: response[0] as boolean,
      currentRoom: response[1] as string,
      lastUpdated: Number(response[2]),
    };
  }

  // Sabotage type constants
  static readonly SABOTAGE_TYPES = {
    SLOW: 1,
    BLOCK: 2,
    DAMAGE: 3,
    ENEMY: 4,
  };

  // Sabotage costs
  static readonly SABOTAGE_COSTS = {
    SLOW: 50,
    BLOCK: 75,
    DAMAGE: 100,
    ENEMY: 125,
  };

  // Cooldown durations (in seconds)
  static readonly COOLDOWN_DURATIONS = {
    SLOW: 10,
    BLOCK: 15,
    DAMAGE: 12,
    ENEMY: 20,
  };
}

// Helper function to create a new Aptos account
export function createAptosAccount(privateKeyHex?: string): AptosAccount {
  if (privateKeyHex) {
    const privateKeyBytes = new Uint8Array(
      privateKeyHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
    );
    return new AptosAccount(privateKeyBytes);
  }
  return new AptosAccount();
}

// Helper function to get current timestamp in seconds
export function getCurrentTimestamp(): number {
  return Math.floor(Date.now() / 1000);
} 