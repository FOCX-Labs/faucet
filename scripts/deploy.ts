import "dotenv/config";

// Set proxy environment variables
process.env.HTTP_PROXY = "http://localhost:7897";
process.env.HTTPS_PROXY = "http://localhost:7897";
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // Ignore SSL certificate verification

process.env.ANCHOR_PROVIDER_URL = process.env.ANCHOR_PROVIDER_URL || "https://devnet.helius-rpc.com/?api-key=48e26d41-1ec0-4a29-ac33-fa26d0112cef";
process.env.ANCHOR_WALLET = process.env.ANCHOR_WALLET || require("os").homedir() + "/.config/solana/id.json";

console.log("🔧 Environment variables:");
console.log("HTTP_PROXY:", process.env.HTTP_PROXY);
console.log("HTTPS_PROXY:", process.env.HTTPS_PROXY);
console.log("ANCHOR_PROVIDER_URL:", process.env.ANCHOR_PROVIDER_URL);

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Faucet } from "../target/types/faucet";
import {
  PublicKey,
  SystemProgram,
  Transaction,
  Connection,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
} from "@solana/spl-token";
import { TOKEN_CONFIG, validateTokenConfig } from "../config/token-config";

async function main() {
  // Validate token configuration
  validateTokenConfig();

  console.log("🌐 Testing connection...");
  
  // Create connection
  const connection = new Connection(
    process.env.ANCHOR_PROVIDER_URL || "https://devnet.helius-rpc.com/?api-key=48e26d41-1ec0-4a29-ac33-fa26d0112cef",
    {
      commitment: "confirmed",
      httpHeaders: {
        "User-Agent": "Anchor-Client",
      },
    }
  );

  // Test connection
  try {
    const slot = await connection.getSlot();
    console.log("✅ Connection successful! Current slot:", slot);
  } catch (error) {
    console.error("❌ Connection failed:", error);
    throw error;
  }

  // Use AnchorProvider wallet as deployer
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const deployer = provider.wallet;

  const program = anchor.workspace.Faucet as Program<Faucet>;

  console.log("Deployer account:", deployer.publicKey.toBase58());
  console.log("Using existing USDC-FOCX token:", TOKEN_CONFIG.USDC_FOCX_MINT.toBase58());

  // Program derived address
  const [faucetPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("faucet")],
    program.programId
  );

  // Create faucet's token account
  const faucetTokenAccount = await getAssociatedTokenAddress(
    TOKEN_CONFIG.USDC_FOCX_MINT,
    faucetPda,
    true
  );

  console.log("🏗️  Creating token account...");

  // Create token account
  const createTokenAccountTx = new Transaction().add(
    createAssociatedTokenAccountInstruction(
      deployer.publicKey,
      faucetTokenAccount,
      faucetPda,
      TOKEN_CONFIG.USDC_FOCX_MINT
    )
  );

  await provider.sendAndConfirm(createTokenAccountTx);

  console.log("✅ Token account created!");

  // Mint initial tokens to faucet's token account
  // Note: This requires mint authority signature
  const mintToFaucetTx = new Transaction().add(
    createMintToInstruction(
      TOKEN_CONFIG.USDC_FOCX_MINT,
      faucetTokenAccount,
      TOKEN_CONFIG.USDC_FOCX_MINT_AUTHORITY,
      10000000 * Math.pow(10, TOKEN_CONFIG.DECIMALS) // 10 million tokens
    )
  );

  // This requires mint authority signature, you need to provide private key
  // Or replenish tokens to faucet account through other means
  console.log("⚠️  Please manually transfer USDC-FOCX tokens to faucet account:");
  console.log("Faucet Token Account:", faucetTokenAccount.toBase58());
  console.log("Amount needed: 10,000,000 USDC-FOCX");

  console.log("🚀 Initializing faucet...");

  // Initialize faucet
  try {
    const tx = await (program.methods as any)
      .initialize()
      .accounts({
        faucet: faucetPda,
        authority: deployer.publicKey,
        tokenMint: TOKEN_CONFIG.USDC_FOCX_MINT,
        tokenAccount: faucetTokenAccount,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([])
      .rpc();

    console.log("✅ Faucet deployed successfully!");
    console.log("Transaction signature:", tx);
    console.log("Program ID:", program.programId.toBase58());
    console.log("Faucet PDA:", faucetPda.toBase58());
    console.log("Token Mint:", TOKEN_CONFIG.USDC_FOCX_MINT.toBase58());
    console.log("Faucet Token Account:", faucetTokenAccount.toBase58());
    console.log("Authority:", deployer.publicKey.toBase58());
    
    console.log("\n📋 Deployment Summary:");
    console.log("Exchange Rate: 1 SOL =", TOKEN_CONFIG.EXCHANGE_RATE, TOKEN_CONFIG.SYMBOL);
    console.log("Token Mint: ", TOKEN_CONFIG.USDC_FOCX_MINT.toBase58());
    console.log("⚠️  Remember to transfer tokens to faucet account!");
    
  } catch (error) {
    console.error("❌ Error deploying faucet:", error);
    console.error("Error details:", String(error));
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
}); 