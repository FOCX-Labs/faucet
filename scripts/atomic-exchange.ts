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
 * 稳定版原子交易脚本：在一个交易中创建 ATA + 兑换代币
 */
async function executeAtomicExchange(walletPath: string): Promise<string> {
  console.log("🎯 执行原子交易：ATA 创建 + SOL 兑换代币");
  console.log("=".repeat(60));

  // 设置环境
  process.env.ANCHOR_PROVIDER_URL =
    "https://devnet.helius-rpc.com/?api-key=48e26d41-1ec0-4a29-ac33-fa26d0112cef";
  process.env.ANCHOR_WALLET = walletPath;

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Faucet as Program<Faucet>;

  // 加载用户钱包
  const walletData = JSON.parse(fs.readFileSync(walletPath, "utf8"));
  const userKeypair = anchor.web3.Keypair.fromSecretKey(new Uint8Array(walletData));

  console.log("👤 用户信息:");
  console.log("- 地址:", userKeypair.publicKey.toBase58());

  // 硬编码的水龙头信息（避免网络问题）
  const faucetTokenAccount = new PublicKey("FQjHQXy7S4m8Xhq1FCxomjr3YjjYm9hQsEL5S1vTkxvY");
  const faucetAuthority = new PublicKey("DjBk7pZfKTnvHg1nhowR6HzTJpVijgoWzZTArm7Yra6X");

  // 计算用户 ATA 地址
  const userTokenAccount = await getAssociatedTokenAddress(
    TOKEN_CONFIG.USDC_FOCX_MINT,
    userKeypair.publicKey
  );

  console.log("\n🏦 账户信息:");
  console.log("- 用户 ATA:", userTokenAccount.toBase58());
  console.log("- 水龙头代币账户:", faucetTokenAccount.toBase58());
  console.log("- 水龙头 Authority:", faucetAuthority.toBase58());

  // 智能检查 ATA 是否存在
  let ataExists = false;
  console.log("\n🔍 检查用户 ATA 是否存在...");
  try {
    const tokenAccount = await getAccount(provider.connection, userTokenAccount);
    ataExists = true;
    const currentBalance = Number(tokenAccount.amount) / Math.pow(10, TOKEN_CONFIG.DECIMALS);
    console.log("✅ ATA 已存在，将跳过创建");
    console.log("- 当前代币余额:", currentBalance, TOKEN_CONFIG.SYMBOL);
  } catch (error: any) {
    if (
      error.name === "TokenAccountNotFoundError" ||
      error.message.includes("could not find account")
    ) {
      console.log("📝 ATA 不存在，将在交易中创建");
    } else {
      console.log("⚠️ 检查 ATA 时出现其他错误，假设不存在:", error.message);
    }
  }

  // 构建智能原子交易
  console.log("\n🔨 构建智能原子交易...");
  const transaction = new Transaction();
  const exchangeAmount = 0.1 * LAMPORTS_PER_SOL;

  // 1. 智能判断：如果需要，添加 ATA 创建指令
  if (!ataExists) {
    console.log("📝 添加 ATA 创建指令（ATA 不存在）...");
    const createATAInstruction = createAssociatedTokenAccountInstruction(
      userKeypair.publicKey, // payer
      userTokenAccount, // ata
      userKeypair.publicKey, // owner
      TOKEN_CONFIG.USDC_FOCX_MINT // mint
    );
    transaction.add(createATAInstruction);
    console.log("  ✅ ATA 创建指令已添加");
  } else {
    console.log("✅ 智能跳过 ATA 创建（ATA 已存在）");
  }

  // 2. 添加 SOL 兑换代币指令
  console.log("💱 添加兑换指令...");

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

  console.log(`✅ 智能原子交易构建完成，包含 ${transaction.instructions.length} 个指令`);
  if (!ataExists) {
    console.log("- 指令 1: 创建 ATA（智能添加）");
    console.log("- 指令 2: SOL 兑换代币");
    console.log("🔒 两个指令将在同一个交易中执行，确保原子性");
  } else {
    console.log("- 指令 1: SOL 兑换代币");
    console.log("🔒 单个指令交易（ATA 已存在，智能跳过创建）");
  }

  // 兑换参数
  console.log("\n💱 兑换参数:");
  console.log("- 兑换金额:", exchangeAmount / LAMPORTS_PER_SOL, "SOL");
  console.log(
    "- 预期获得:",
    (exchangeAmount * TOKEN_CONFIG.EXCHANGE_RATE) / Math.pow(10, TOKEN_CONFIG.DECIMALS),
    TOKEN_CONFIG.SYMBOL
  );

  // 执行原子交易
  console.log("\n📡 执行原子交易...");
  const signature = await provider.sendAndConfirm(transaction, [userKeypair]);

  console.log("✅ 原子交易成功!");
  console.log("交易签名:", signature);
  console.log("🔗 交易链接:", `https://explorer.solana.com/tx/${signature}?cluster=devnet`);

  // 验证结果
  console.log("\n🔍 验证交易结果...");
  try {
    const tokenAccount = await getAccount(provider.connection, userTokenAccount);
    const tokenBalance = Number(tokenAccount.amount) / Math.pow(10, TOKEN_CONFIG.DECIMALS);

    console.log("✅ 智能原子交易验证结果:");
    if (!ataExists) {
      console.log("- ATA 创建: ✅ 成功（智能创建）");
    } else {
      console.log("- ATA 状态: ✅ 已存在（智能跳过创建）");
    }
    console.log("- ATA 地址:", userTokenAccount.toBase58());
    console.log("- 最终代币余额:", tokenBalance, TOKEN_CONFIG.SYMBOL);

    const expectedTokens =
      (exchangeAmount * TOKEN_CONFIG.EXCHANGE_RATE) / Math.pow(10, TOKEN_CONFIG.DECIMALS);
    console.log("- 本次获得代币:", expectedTokens, TOKEN_CONFIG.SYMBOL);

    console.log("\n🎉 智能原子交易验证完成!");
  } catch (error: any) {
    console.error("❌ 验证失败:", error.message);
  }

  return signature;
}

/**
 * 主函数
 */
async function main() {
  try {
    console.log("🎯 Solana 水龙头原子交易脚本");
    console.log("=".repeat(60));

    // 配置参数
    const walletPath = process.argv[2] || "stable-test-wallet.json";

    console.log("📋 配置信息:");
    console.log("- 钱包文件:", walletPath);
    console.log("- RPC 端点: https://devnet.helius-rpc.com");

    // 执行原子交易
    const signature = await executeAtomicExchange(walletPath);

    console.log("\n🎉 脚本执行成功!");
    console.log("📋 最终总结:");
    console.log("- 交易签名:", signature);
    console.log("- 兑换金额: 0.1 SOL");
    console.log("- 预期代币: 1000 USDC-FOCX");
  } catch (error: any) {
    console.error("\n❌ 脚本执行失败:", error.message);
    if (error.logs) {
      console.error("错误日志:");
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
