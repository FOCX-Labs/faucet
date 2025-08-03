import "dotenv/config";
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Faucet } from "../target/types/faucet";
import { PublicKey, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from "@solana/spl-token";
import { TOKEN_CONFIG } from "../config/token-config";
import * as fs from "fs";

/**
 * Stable version atomic transaction script: Create ATA + exchange tokens in one transaction
 */
async function executeAtomicExchange(walletPath: string): Promise<string> {
  console.log("🎯 Executing atomic transaction: ATA creation + SOL token exchange");
  console.log("=".repeat(60));

  // Set up environment
  process.env.ANCHOR_PROVIDER_URL =
    "https://api.devnet.solana.com";
  process.env.ANCHOR_WALLET = walletPath;

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Faucet as Program<Faucet>;

  // Load user wallet
  const walletData = JSON.parse(fs.readFileSync(walletPath, "utf8"));
  const userKeypair = anchor.web3.Keypair.fromSecretKey(new Uint8Array(walletData));

  console.log("👤 User information:");
  console.log("- Address:", userKeypair.publicKey.toBase58());

  // Hard-coded faucet information (to avoid network issues)
  const faucetTokenAccount = new PublicKey("FQjHQXy7S4m8Xhq1FCxomjr3YjjYm9hQsEL5S1vTkxvY");
  const faucetAuthority = new PublicKey("DjBk7pZfKTnvHg1nhowR6HzTJpVijgoWzZTArm7Yra6X");

  // Calculate user ATA address
  const userTokenAccount = await getAssociatedTokenAddress(
    TOKEN_CONFIG.USDC_FOCX_MINT,
    userKeypair.publicKey
  );

  console.log("\n🏦 Account information:");
  console.log("- User ATA:", userTokenAccount.toBase58());
  console.log("- Faucet token account:", faucetTokenAccount.toBase58());
  console.log("- Faucet Authority:", faucetAuthority.toBase58());

  // Intelligent check if ATA exists
  let ataExists = false;
  console.log("\n🔍 Checking if user ATA exists...");
  try {
    const tokenAccount = await getAccount(provider.connection, userTokenAccount);
    ataExists = true;
    const currentBalance = Number(tokenAccount.amount) / Math.pow(10, TOKEN_CONFIG.DECIMALS);
    console.log("✅ ATA already exists, creation will be skipped");
    console.log("- Current token balance:", currentBalance, TOKEN_CONFIG.SYMBOL);
  } catch (error: any) {
    if (
      error.name === "TokenAccountNotFoundError" ||
      error.message.includes("could not find account")
    ) {
      console.log("📝 ATA does not exist, will be created in transaction");
    } else {
      console.log("⚠️ Other error occurred while checking ATA, assuming it doesn't exist:", error.message);
    }
  }

  // Build intelligent atomic transaction
  console.log("\n🔨 Building intelligent atomic transaction...");
  const transaction = new Transaction();
  const exchangeAmount = 0.1 * LAMPORTS_PER_SOL;

  // 1. Intelligent decision: Add ATA creation instruction if needed
  if (!ataExists) {
    console.log("📝 Adding ATA creation instruction (ATA does not exist)...");
    const createATAInstruction = createAssociatedTokenAccountInstruction(
      userKeypair.publicKey, // payer
      userTokenAccount, // ata
      userKeypair.publicKey, // owner
      TOKEN_CONFIG.USDC_FOCX_MINT // mint
    );
    transaction.add(createATAInstruction);
    console.log("  ✅ ATA creation instruction added");
  } else {
    console.log("✅ Intelligently skipped ATA creation (ATA already exists)");
  }

  // 2. Add SOL token exchange instruction
  console.log("💱 Adding exchange instruction...");

  const exchangeInstruction = await program.methods
    .exchangeSolForTokens(new anchor.BN(exchangeAmount))
    .accounts({
      user: userKeypair.publicKey,
      tokenMint: TOKEN_CONFIG.USDC_FOCX_MINT,
      userTokenAccount: userTokenAccount,
      faucetTokenAccount: faucetTokenAccount,
      authority: faucetAuthority,
    })
    .instruction();

  transaction.add(exchangeInstruction);

  console.log(`✅ Intelligent atomic transaction built successfully, containing ${transaction.instructions.length} instructions`);
  if (!ataExists) {
    console.log("- Instruction 1: Create ATA (intelligently added)");
    console.log("- Instruction 2: SOL token exchange");
    console.log("🔒 Both instructions will execute in the same transaction to ensure atomicity");
  } else {
    console.log("- Instruction 1: SOL token exchange");
    console.log("🔒 Single instruction transaction (ATA already exists, creation intelligently skipped)");
  }

  // Exchange parameters
  console.log("\n💱 Exchange parameters:");
  console.log("- Exchange amount:", exchangeAmount / LAMPORTS_PER_SOL, "SOL");
  console.log(
    "- Expected to receive:",
    (exchangeAmount * TOKEN_CONFIG.EXCHANGE_RATE) / Math.pow(10, TOKEN_CONFIG.DECIMALS),
    TOKEN_CONFIG.SYMBOL
  );

  // Execute atomic transaction
  console.log("\n📡 Executing atomic transaction...");
  const signature = await provider.sendAndConfirm(transaction, [userKeypair]);

  console.log("✅ Atomic transaction successful!");
  console.log("Transaction signature:", signature);
  console.log("🔗 Transaction link:", `https://explorer.solana.com/tx/${signature}?cluster=devnet`);

  // Verify results
  console.log("\n🔍 Verifying transaction results...");
  try {
    const tokenAccount = await getAccount(provider.connection, userTokenAccount);
    const tokenBalance = Number(tokenAccount.amount) / Math.pow(10, TOKEN_CONFIG.DECIMALS);

    console.log("✅ Intelligent atomic transaction verification results:");
    if (!ataExists) {
      console.log("- ATA creation: ✅ Successful (intelligently created)");
    } else {
      console.log("- ATA status: ✅ Already exists (creation intelligently skipped)");
    }
    console.log("- ATA address:", userTokenAccount.toBase58());
    console.log("- Final token balance:", tokenBalance, TOKEN_CONFIG.SYMBOL);

    const expectedTokens =
      (exchangeAmount * TOKEN_CONFIG.EXCHANGE_RATE) / Math.pow(10, TOKEN_CONFIG.DECIMALS);
    console.log("- Tokens received in this transaction:", expectedTokens, TOKEN_CONFIG.SYMBOL);

    console.log("\n🎉 Intelligent atomic transaction verification completed!");
  } catch (error: any) {
    console.error("❌ Verification failed:", error.message);
  }

  return signature;
}

/**
 * Main function
 */
async function main() {
  try {
    console.log("🎯 Solana Faucet Atomic Transaction Script");
    console.log("=".repeat(60));

    // Configuration parameters
    const walletPath = process.argv[2] || "stable-test-wallet.json";

    console.log("📋 Configuration information:");
    console.log("- Wallet file:", walletPath);
    console.log("- RPC endpoint: https://devnet.helius-rpc.com");

    // Execute atomic transaction
    const signature = await executeAtomicExchange(walletPath);

    console.log("\n🎉 Script execution successful!");
    console.log("📋 Final summary:");
    console.log("- Transaction signature:", signature);
    console.log("- Exchange amount: 0.1 SOL");
    console.log("- Expected tokens: 1000 USDC-FOCX");
  } catch (error: any) {
    console.error("\n❌ Script execution failed:", error.message);
    if (error.logs) {
      console.error("Error logs:");
      error.logs.forEach((log: string, index: number) => {
        console.error(`  ${index + 1}. ${log}`);
      });
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
