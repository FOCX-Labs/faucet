# Solana Faucet Contract

This is a simple Solana faucet contract that allows users to deposit devnet SOL to receive USDC-FOCX tokens.

```
Program ID: 3JtTpsLxSAYZweorwjU9cywAFLm8BUonGwQ54gqFnAGg
Faucet PDA: 6RBoURcUvCjHs3ziXXy2DBJjWmotkCqBVW2GWCGvAPX
Token Mint: DXDVt289yXEcqXDd9Ub3HqSBTWwrmNB8DzQEagv9Svtu
Faucet Token Account: FQjHQXy7S4m8Xhq1FCxomjr3YjjYm9hQsEL5S1vTkxvY
Authority: DjBk7pZfKTnvHg1nhowR6HzTJpVijgoWzZTArm7Yra6X
```

## Features

- **SOL Exchange**: Users can deposit SOL to receive USDC-FOCX tokens
- **Fixed Exchange Rate**: 1 SOL = 10000 USDC-FOCX
- **Admin Functions**: Administrators can withdraw SOL and tokens
- **Fund Replenishment**: Anyone can directly send USDC-FOCX to the contract address to replenish funds

## Contract Functions

### Main Instructions

1. **initialize**: Initialize the faucet contract
2. **exchange_sol_for_tokens**: Users exchange SOL for tokens
3. **withdraw_sol**: Administrator withdraws SOL
4. **withdraw_tokens**: Administrator withdraws tokens

### Security Features

- Uses PDA (Program Derived Address) to ensure security
- Permission verification, only administrators can withdraw funds
- Balance checks to prevent over-withdrawal

## Environment Requirements

- Node.js 16+
- Rust 1.70+
- Solana CLI 1.16+
- Anchor CLI 0.31+

## Installation Steps

### 1. Install Dependencies

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/v1.16.0/install)"

# Install Anchor CLI
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install 0.31.1
avm use 0.31.1

# Install project dependencies
npm install
```

### 2. Configure Solana

```bash
# Set devnet
solana config set --url devnet

# Create wallet (if not already created)
solana-keygen new

# Get devnet SOL
solana airdrop 2
```

## Compilation and Deployment

### 1. Compile Contract

```bash
# Build project
anchor build

# Generate IDL types
anchor idl init --filepath target/idl/faucet.json Faucet111111111111111111111111111111111111
```

### 2. Deploy to Devnet

```bash
# Deploy program
anchor deploy

# Run deployment script
npx ts-node scripts/deploy.ts
```

### 3. Verify Deployment

```bash
# Check program status
solana program show Faucet111111111111111111111111111111111111

# View account information
solana account <FAUCET_PDA_ADDRESS>
```

## Testing

### Run Tests

```bash
# Run all tests
anchor test

# Run specific tests
anchor test --skip-local-validator

# Test on devnet
anchor test --provider.cluster devnet
```

### Test Coverage

- ✅ Initialize faucet
- ✅ Exchange SOL for tokens
- ✅ Administrator withdraw SOL
- ✅ Administrator withdraw tokens
- ✅ Insufficient balance error handling
- ✅ Permission verification

## Usage Examples

### 1. User Exchange Tokens

```typescript
// User exchanges 0.1 SOL for tokens
const solAmount = 0.1 * LAMPORTS_PER_SOL; // 0.1 SOL
const expectedTokens = solAmount * 10000; // 1000 USDC-FOCX

await program.methods
  .exchangeSolForTokens(new anchor.BN(solAmount))
  .accounts({
    faucet: faucetPda,
    user: user.publicKey,
    tokenMint: tokenMint,
    userTokenAccount: userTokenAccount,
    faucetTokenAccount: faucetTokenAccount,
    authority: authority.publicKey,
    systemProgram: SystemProgram.programId,
    tokenProgram: TOKEN_PROGRAM_ID,
  })
  .signers([user])
  .rpc();
```

### 2. Administrator Withdraw SOL

```typescript
const withdrawAmount = 0.05 * LAMPORTS_PER_SOL;

await program.methods
  .withdrawSol(new anchor.BN(withdrawAmount))
  .accounts({
    faucet: faucetPda,
    authority: authority.publicKey,
    recipient: authority.publicKey,
    systemProgram: SystemProgram.programId,
  })
  .signers([authority])
  .rpc();
```

## Project Structure

```
faucet/
├── Anchor.toml              # Anchor configuration file
├── package.json             # Project dependencies
├── tsconfig.json           # TypeScript configuration
├── programs/
│   └── faucet/
│       ├── Cargo.toml      # Rust dependencies
│       └── src/
│           └── lib.rs      # Main program code
├── tests/
│   └── faucet.test.ts      # Test files
├── scripts/
│   └── deploy.ts           # Deployment script
└── README.md               # Project documentation
```

## Important Addresses

After deployment, you will get the following important addresses:

- **Program ID**: `Faucet111111111111111111111111111111111111`
- **Faucet PDA**: Program-derived faucet account address
- **Token Mint**: USDC-FOCX token mint account address
- **Faucet Token Account**: Faucet's token account address

## Fund Replenishment

Anyone can replenish USDC-FOCX tokens to the faucet in the following ways:

1. Directly send tokens to the faucet's token account address
2. Use SPL Token program's standard transfer instruction

## Troubleshooting

### Common Issues

1. **Compilation Errors**
   ```bash
   # Clean and rebuild
   anchor clean
   anchor build
   ```

2. **Deployment Failures**
   ```bash
   # Check network connection
   solana config get
   
   # Check balance
   solana balance
   ```

3. **Test Failures**
   ```bash
   # Regenerate IDL
   anchor idl init --filepath target/idl/faucet.json Faucet111111111111111111111111111111111111
   ```

## License

MIT License

## Contributing

Issues and Pull Requests are welcome! 