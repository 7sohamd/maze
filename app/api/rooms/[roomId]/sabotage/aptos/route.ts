import { NextRequest, NextResponse } from "next/server";
import { MazeGameClient, createAptosAccount, getCurrentTimestamp } from "@/lib/aptos-client";

const SABOTAGES = [
  {
    id: "slow",
    name: "Slow Down",
    description: "Reduce player speed by 30%",
    type: 1,
  },
  {
    id: "block",
    name: "Block Path",
    description: "Place obstacle near player",
    type: 2,
  },
  {
    id: "damage",
    name: "Damage",
    description: "Reduce player health",
    type: 3,
  },
  {
    id: "enemy",
    name: "Spawn Enemy",
    description: "Spawn enemy near player",
    type: 4,
  },
];

export async function POST(request: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const { roomId } = await params;
    const { action, userAddress, privateKey, playerAddress } = await request.json();

    if (!action || !userAddress) {
      return NextResponse.json({ error: "Missing action or user address" }, { status: 400 });
    }

    // Initialize Aptos client (use testnet for development)
    const client = new MazeGameClient("https://fullnode.testnet.aptoslabs.com");
    
    // Create account from private key or create new one
    let account: any;
    if (privateKey) {
      account = createAptosAccount(privateKey);
    } else {
      // For demo purposes, create a new account
      // In production, you'd want to get this from user's wallet
      account = createAptosAccount();
    }

    // Find the sabotage action
    const sabotage = SABOTAGES.find(s => s.id === action);
    if (!sabotage) {
      return NextResponse.json({ error: "Invalid sabotage action" }, { status: 400 });
    }

    // Get current timestamp
    const currentTimestamp = getCurrentTimestamp();

    try {
      // Initialize account if needed
      await client.initializeAccount(account);

      // Check user's token balance
      const balance = await client.getTokenBalance(account.address().toString());
      const cost = MazeGameClient.SABOTAGE_COSTS[sabotage.id.toUpperCase() as keyof typeof MazeGameClient.SABOTAGE_COSTS];

      if (balance < cost) {
        return NextResponse.json({ 
          error: "Insufficient tokens", 
          balance, 
          required: cost 
        }, { status: 400 });
      }

      // Check cooldown
      const cooldowns = await client.getSabotageCooldowns(account.address().toString());
      const cooldownKey = sabotage.id as keyof typeof cooldowns;
      const cooldownEnd = cooldowns[cooldownKey];

      if (currentTimestamp < cooldownEnd) {
        const remainingCooldown = cooldownEnd - currentTimestamp;
        return NextResponse.json({ 
          error: "Sabotage on cooldown", 
          remainingCooldown 
        }, { status: 400 });
      }

      // Execute sabotage on blockchain
      const txHash = await client.executeSabotage(
        account,
        sabotage.type,
        roomId,
        currentTimestamp
      );

      // Transfer tokens from watcher to player if player address is provided
      let transferTxHash = null;
      if (playerAddress && playerAddress !== userAddress) {
        try {
          // Transfer 80% of the cost to the player (20% goes to game fees)
          const transferAmount = Math.floor(cost * 0.8);
          transferTxHash = await client.transferTokens(
            account,
            playerAddress,
            transferAmount,
            `Sabotage reward for ${sabotage.name} in room ${roomId}`
          );
        } catch (transferError) {
          console.error("Failed to transfer tokens to player:", transferError);
          // Don't fail the entire sabotage if transfer fails
        }
      }

      return NextResponse.json({ 
        success: true, 
        sabotage: {
          id: sabotage.id,
          name: sabotage.name,
          description: sabotage.description,
        },
        transactionHash: txHash,
        transferTransactionHash: transferTxHash,
        newBalance: balance - cost,
        transferredToPlayer: playerAddress ? Math.floor(cost * 0.8) : 0,
      });

    } catch (error: any) {
      console.error("Aptos transaction error:", error);
      return NextResponse.json({ 
        error: "Failed to execute sabotage on blockchain",
        details: error.message 
      }, { status: 500 });
    }

  } catch (error) {
    console.error("Aptos sabotage route error:", error);
    return NextResponse.json({ error: "Failed to process Aptos sabotage request" }, { status: 500 });
  }
}

// Get user's token balance and cooldowns
export async function GET(request: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const { searchParams } = new URL(request.url);
    const userAddress = searchParams.get('userAddress');
    const privateKey = searchParams.get('privateKey');

    if (!userAddress) {
      return NextResponse.json({ error: "Missing user address" }, { status: 400 });
    }

    const client = new MazeGameClient("https://fullnode.testnet.aptoslabs.com");
    
    let account: any;
    if (privateKey) {
      account = createAptosAccount(privateKey);
    } else {
      // For demo purposes, create a new account
      account = createAptosAccount();
    }

    try {
      // Get user's token balance
      const balance = await client.getTokenBalance(account.address().toString());
      
      // Get user's cooldowns
      const cooldowns = await client.getSabotageCooldowns(account.address().toString());
      const currentTimestamp = getCurrentTimestamp();

      // Calculate remaining cooldowns
      const remainingCooldowns = {
        slow: Math.max(0, cooldowns.slow - currentTimestamp),
        block: Math.max(0, cooldowns.block - currentTimestamp),
        damage: Math.max(0, cooldowns.damage - currentTimestamp),
        enemy: Math.max(0, cooldowns.enemy - currentTimestamp),
      };

      return NextResponse.json({
        balance,
        cooldowns: remainingCooldowns,
        sabotageCosts: MazeGameClient.SABOTAGE_COSTS,
      });

    } catch (error: any) {
      console.error("Aptos query error:", error);
      return NextResponse.json({ 
        error: "Failed to query blockchain data",
        details: error.message 
      }, { status: 500 });
    }

  } catch (error) {
    console.error("Aptos balance route error:", error);
    return NextResponse.json({ error: "Failed to get user data" }, { status: 500 });
  }
} 