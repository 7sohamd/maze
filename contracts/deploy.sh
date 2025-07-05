#!/bin/bash

# Maze Game Smart Contract Deployment Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Maze Game Smart Contract Deployment${NC}"
echo "=================================="

# Check if aptos CLI is installed
if ! command -v aptos &> /dev/null; then
    echo -e "${RED}❌ Aptos CLI is not installed. Please install it first:${NC}"
    echo "https://aptos.dev/tools/aptos-cli/"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "Move.toml" ]; then
    echo -e "${RED}❌ Move.toml not found. Please run this script from the contracts directory.${NC}"
    exit 1
fi

# Function to get user input
get_input() {
    local prompt="$1"
    local default="$2"
    local input
    
    if [ -n "$default" ]; then
        read -p "$prompt [$default]: " input
        echo "${input:-$default}"
    else
        read -p "$prompt: " input
        echo "$input"
    fi
}

# Get deployment configuration
echo -e "${YELLOW}📋 Deployment Configuration${NC}"
echo "----------------------------"

NETWORK=$(get_input "Select network (testnet/mainnet)" "testnet")
PROFILE_NAME=$(get_input "Enter profile name" "maze_game_$NETWORK")

# Initialize Aptos profile if it doesn't exist
if ! aptos profile list | grep -q "$PROFILE_NAME"; then
    echo -e "${YELLOW}🔧 Initializing Aptos profile: $PROFILE_NAME${NC}"
    aptos init --profile "$PROFILE_NAME" --network "$NETWORK"
else
    echo -e "${GREEN}✅ Profile $PROFILE_NAME already exists${NC}"
fi

# Get the account address
ACCOUNT_ADDRESS=$(aptos account list --profile "$PROFILE_NAME" | grep "Account Address" | awk '{print $3}')

if [ -z "$ACCOUNT_ADDRESS" ]; then
    echo -e "${RED}❌ Could not get account address${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Account Address: $ACCOUNT_ADDRESS${NC}"

# Update Move.toml with the account address
echo -e "${YELLOW}📝 Updating Move.toml...${NC}"
sed -i.bak "s/maze_game = \"_\"/maze_game = \"$ACCOUNT_ADDRESS\"/" Move.toml

# Check account balance
echo -e "${YELLOW}💰 Checking account balance...${NC}"
BALANCE=$(aptos account list --profile "$PROFILE_NAME" | grep "APT Coin" | awk '{print $3}' | sed 's/,//')

if [ "$BALANCE" = "0" ] || [ -z "$BALANCE" ]; then
    echo -e "${RED}❌ Insufficient balance. Please fund your account with APT tokens.${NC}"
    if [ "$NETWORK" = "testnet" ]; then
        echo -e "${BLUE}💡 You can get testnet tokens from: https://aptoslabs.com/testnet-faucet${NC}"
    fi
    exit 1
fi

echo -e "${GREEN}✅ Account Balance: $BALANCE APT${NC}"

# Compile the contract
echo -e "${YELLOW}🔨 Compiling contract...${NC}"
if aptos move compile --named-addresses maze_game="$ACCOUNT_ADDRESS" --profile "$PROFILE_NAME"; then
    echo -e "${GREEN}✅ Compilation successful${NC}"
else
    echo -e "${RED}❌ Compilation failed${NC}"
    exit 1
fi

# Deploy the contract
echo -e "${YELLOW}🚀 Deploying contract...${NC}"
if aptos move publish --named-addresses maze_game="$ACCOUNT_ADDRESS" --profile "$PROFILE_NAME"; then
    echo -e "${GREEN}✅ Deployment successful!${NC}"
else
    echo -e "${RED}❌ Deployment failed${NC}"
    exit 1
fi

# Get the transaction hash
TX_HASH=$(aptos account list --profile "$PROFILE_NAME" | grep "Last Transaction" | awk '{print $3}')

echo ""
echo -e "${GREEN}🎉 Deployment Complete!${NC}"
echo "================================"
echo -e "${BLUE}Network:${NC} $NETWORK"
echo -e "${BLUE}Account Address:${NC} $ACCOUNT_ADDRESS"
echo -e "${BLUE}Transaction Hash:${NC} $TX_HASH"
echo -e "${BLUE}Module Address:${NC} $ACCOUNT_ADDRESS::maze_game::game_tokens"

# Update the client configuration
echo ""
echo -e "${YELLOW}📝 Updating client configuration...${NC}"
CLIENT_FILE="../../lib/aptos-client.ts"

if [ -f "$CLIENT_FILE" ]; then
    # Create backup
    cp "$CLIENT_FILE" "$CLIENT_FILE.bak"
    
    # Update the module address
    sed -i "s/this.moduleAddress = moduleAddress || \"0x1\";/this.moduleAddress = moduleAddress || \"$ACCOUNT_ADDRESS\";/" "$CLIENT_FILE"
    
    echo -e "${GREEN}✅ Client configuration updated${NC}"
    echo -e "${BLUE}Backup saved as:${NC} $CLIENT_FILE.bak"
else
    echo -e "${YELLOW}⚠️  Client file not found at $CLIENT_FILE${NC}"
fi

echo ""
echo -e "${GREEN}🎮 Your Maze Game smart contract is ready!${NC}"
echo -e "${BLUE}Next steps:${NC}"
echo "1. Update your frontend to use the new module address"
echo "2. Test the contract functions"
echo "3. Integrate with your game logic"

# Clean up backup files
rm -f Move.toml.bak

echo ""
echo -e "${BLUE}🔗 View your contract on Aptos Explorer:${NC}"
if [ "$NETWORK" = "testnet" ]; then
    echo "https://explorer.aptoslabs.com/account/$ACCOUNT_ADDRESS?network=testnet"
else
    echo "https://explorer.aptoslabs.com/account/$ACCOUNT_ADDRESS"
fi 