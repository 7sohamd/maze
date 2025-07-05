# Maze Game Smart Contract Deployment Script (PowerShell)

param(
    [string]$Network = "testnet",
    [string]$ProfileName = ""
)

# Set error action preference
$ErrorActionPreference = "Stop"

# Colors for output
$Red = "Red"
$Green = "Green"
$Yellow = "Yellow"
$Blue = "Blue"

function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

Write-ColorOutput "Maze Game Smart Contract Deployment" $Blue
Write-ColorOutput "=================================="

# Check if aptos CLI is installed
try {
    $null = Get-Command aptos -ErrorAction Stop
} catch {
    Write-ColorOutput "Aptos CLI is not installed. Please install it first:" $Red
    Write-ColorOutput "https://aptos.dev/tools/aptos-cli/"
    exit 1
}

# Check if we're in the right directory
if (-not (Test-Path "Move.toml")) {
    Write-ColorOutput "Move.toml not found. Please run this script from the contracts directory." $Red
    exit 1
}

# Set default profile name if not provided
if (-not $ProfileName) {
    $ProfileName = "maze_game_$Network"
}

# Get deployment configuration
Write-ColorOutput "Deployment Configuration" $Yellow
Write-ColorOutput "----------------------------"

$Network = Read-Host "Select network (testnet/mainnet) [$Network]"
if (-not $Network) { $Network = "testnet" }

$ProfileName = Read-Host "Enter profile name [$ProfileName]"
if (-not $ProfileName) { $ProfileName = "maze_game_$Network" }

# Initialize Aptos profile if it doesn't exist
$existingProfiles = aptos profile list 2>$null | Select-String $ProfileName
if (-not $existingProfiles) {
    Write-ColorOutput "Initializing Aptos profile: $ProfileName" $Yellow
    aptos init --profile $ProfileName --network $Network
} else {
    Write-ColorOutput "Profile $ProfileName already exists" $Green
}

# Get the account address
$accountInfo = aptos account list --profile $ProfileName 2>$null
$accountAddress = ($accountInfo | Select-String "Account Address").ToString().Split()[-1]

if (-not $accountAddress) {
    Write-ColorOutput "Could not get account address" $Red
    exit 1
}

Write-ColorOutput "Account Address: $accountAddress" $Green

# Update Move.toml with the account address
Write-ColorOutput "Updating Move.toml..." $Yellow
$moveTomlContent = Get-Content "Move.toml" -Raw
$moveTomlContent = $moveTomlContent -replace 'maze_game = "_"', "maze_game = `"$accountAddress`""
$moveTomlContent | Set-Content "Move.toml"

# Check account balance
Write-ColorOutput "Checking account balance..." $Yellow
$balanceInfo = ($accountInfo | Select-String "APT Coin").ToString()
$balance = ($balanceInfo -split '\s+')[-1] -replace ',', ''

if ($balance -eq "0" -or -not $balance) {
    Write-ColorOutput "Insufficient balance. Please fund your account with APT tokens." $Red
    if ($Network -eq "testnet") {
        Write-ColorOutput "You can get testnet tokens from: https://aptoslabs.com/testnet-faucet" $Blue
    }
    exit 1
}

Write-ColorOutput "Account Balance: $balance APT" $Green

# Compile the contract
Write-ColorOutput "Compiling contract..." $Yellow
try {
    aptos move compile --named-addresses "maze_game=$accountAddress" --profile $ProfileName
    Write-ColorOutput "Compilation successful" $Green
} catch {
    Write-ColorOutput "Compilation failed" $Red
    exit 1
}

# Deploy the contract
Write-ColorOutput "Deploying contract..." $Yellow
try {
    aptos move publish --named-addresses "maze_game=$accountAddress" --profile $ProfileName
    Write-ColorOutput "Deployment successful!" $Green
} catch {
    Write-ColorOutput "Deployment failed" $Red
    exit 1
}

# Get the transaction hash
$txHash = ($accountInfo | Select-String "Last Transaction").ToString().Split()[-1]

Write-ColorOutput ""
Write-ColorOutput "Deployment Complete!" $Green
Write-ColorOutput "================================"
Write-ColorOutput "Network: $Network" $Blue
Write-ColorOutput "Account Address: $accountAddress" $Blue
Write-ColorOutput "Transaction Hash: $txHash" $Blue
Write-ColorOutput "Module Address: $accountAddress::maze_game::game_tokens" $Blue

# Update the client configuration
Write-ColorOutput ""
Write-ColorOutput "Updating client configuration..." $Yellow
$clientFile = "../../lib/aptos-client.ts"

if (Test-Path $clientFile) {
    # Create backup
    Copy-Item $clientFile "$clientFile.bak"
    
    # Update the module address
    $clientContent = Get-Content $clientFile -Raw
    $pattern = 'this\.moduleAddress = moduleAddress \|\| "0x1";'
    $replacement = "this.moduleAddress = moduleAddress || `"$accountAddress`";"
    $clientContent = $clientContent -replace $pattern, $replacement
    $clientContent | Set-Content $clientFile
    
    Write-ColorOutput "Client configuration updated" $Green
    Write-ColorOutput "Backup saved as: $clientFile.bak" $Blue
} else {
    Write-ColorOutput "Client file not found at $clientFile" $Yellow
}

Write-ColorOutput ""
Write-ColorOutput "Your Maze Game smart contract is ready!" $Green
Write-ColorOutput "Next steps:" $Blue
Write-ColorOutput "1. Update your frontend to use the new module address"
Write-ColorOutput "2. Test the contract functions"
Write-ColorOutput "3. Integrate with your game logic"

Write-ColorOutput ""
Write-ColorOutput "View your contract on Aptos Explorer:" $Blue
if ($Network -eq "testnet") {
    Write-ColorOutput "https://explorer.aptoslabs.com/account/$accountAddress?network=testnet"
} else {
    Write-ColorOutput "https://explorer.aptoslabs.com/account/$accountAddress"
} 