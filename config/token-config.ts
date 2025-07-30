import { PublicKey } from "@solana/web3.js";

// USDC-FOCX token configuration
export const TOKEN_CONFIG = {
  // Please replace with actual USDC-FOCX token address
  USDC_FOCX_MINT: new PublicKey("DXDVt289yXEcqXDd9Ub3HqSBTWwrmNB8DzQEagv9Svtu"),
  
  // Token mint authority address (if available)
  USDC_FOCX_MINT_AUTHORITY: new PublicKey("DjBk7pZfKTnvHg1nhowR6HzTJpVijgoWzZTArm7Yra6X"),
  
  // Token decimals
  DECIMALS: 9,
  
  // Token symbol
  SYMBOL: "USDC-FOCX",
  
  // Token name
  NAME: "USDC-FOCX",
  
  // Exchange rate
  EXCHANGE_RATE: 10000, // 1 SOL = 10000 USDC-FOCX
};

// Network configuration
export const NETWORK_CONFIG = {
  DEVNET: "devnet",
  MAINNET: "mainnet-beta",
  LOCALNET: "localnet",
};

// Program configuration
export const PROGRAM_CONFIG = {
  PROGRAM_ID: "3JtTpsLxSAYZweorwjU9cywAFLm8BUonGwQ54gqFnAGg",
  SEED: "faucet",
};

// Validate token configuration
export function validateTokenConfig() {
  if (TOKEN_CONFIG.USDC_FOCX_MINT.toString() === "YOUR_USDC_FOCX_MINT_ADDRESS_HERE") {
    throw new Error("Please configure USDC_FOCX_MINT address in config/token-config.ts");
  }
  
  if (TOKEN_CONFIG.USDC_FOCX_MINT_AUTHORITY.toString() === "YOUR_MINT_AUTHORITY_ADDRESS_HERE") {
    console.warn("⚠️  USDC_FOCX_MINT_AUTHORITY not configured, you may need to manually transfer tokens");
  }
  
  console.log("✅ Token configuration validated");
  console.log("Token Mint:", TOKEN_CONFIG.USDC_FOCX_MINT.toBase58());
  console.log("Token Symbol:", TOKEN_CONFIG.SYMBOL);
  console.log("Token Decimals:", TOKEN_CONFIG.DECIMALS);
  console.log("Exchange Rate:", TOKEN_CONFIG.EXCHANGE_RATE);
} 