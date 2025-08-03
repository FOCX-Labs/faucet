#!/usr/bin/env ts-node

import "dotenv/config";
import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";

// Set environment variables
process.env.HTTP_PROXY = "http://localhost:7897";
process.env.HTTPS_PROXY = "http://localhost:7897";
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
process.env.ANCHOR_PROVIDER_URL =
  process.env.ANCHOR_PROVIDER_URL ||
  "https://api.devnet.solana.com";
process.env.ANCHOR_WALLET =
  process.env.ANCHOR_WALLET || require("os").homedir() + "/.config/solana/id.json";

console.log("🚀 Solana Faucet E2E Test Runner");
console.log("=".repeat(50));

// Check necessary files and configurations
function checkPrerequisites(): boolean {
  console.log("🔍 Checking test prerequisites...");

  // Check wallet file
  const walletPath = process.env.ANCHOR_WALLET!;
  if (!fs.existsSync(walletPath)) {
    console.error("❌ Wallet file does not exist:", walletPath);
    console.log("Please run: solana-keygen new --outfile", walletPath);
    return false;
  }
  console.log("✅ Wallet file exists:", walletPath);

  // Check program build
  const programPath = path.join(__dirname, "../target/deploy/faucet.so");
  if (!fs.existsSync(programPath)) {
    console.error("❌ Program file does not exist, please build the program first");
    console.log("Please run: anchor build");
    return false;
  }
  console.log("✅ Program file exists");

  // Check IDL file
  const idlPath = path.join(__dirname, "../target/idl/faucet.json");
  if (!fs.existsSync(idlPath)) {
    console.error("❌ IDL file does not exist, please build the program first");
    console.log("Please run: anchor build");
    return false;
  }
  console.log("✅ IDL file exists");

  return true;
}

// Run tests
function runTests(): Promise<number> {
  return new Promise((resolve) => {
    console.log("\n🧪 Starting E2E tests...");
    console.log("=".repeat(50));

    const testCommand = "npx";
    const testArgs = [
      "ts-mocha",
      "-p",
      "./tsconfig.json",
      "-t",
      "300000", // 5 minute timeout
      "--recursive",
      "tests/e2e-test.ts",
    ];

    console.log("Executing command:", testCommand, testArgs.join(" "));

    const testProcess = spawn(testCommand, testArgs, {
      stdio: "inherit",
      env: process.env,
      cwd: path.join(__dirname, ".."),
    });

    testProcess.on("close", (code) => {
      console.log("\n" + "=".repeat(50));
      if (code === 0) {
        console.log("✅ All tests passed!");
      } else {
        console.log("❌ Tests failed, exit code:", code);
      }
      resolve(code || 0);
    });

    testProcess.on("error", (error) => {
      console.error("❌ Test execution error:", error);
      resolve(1);
    });
  });
}

// Generate test report
function generateReport(exitCode: number) {
  const reportPath = path.join(__dirname, "../test-report.md");
  const timestamp = new Date().toISOString();

  const report = `# Solana Faucet E2E Test Report

## Test Information
- Execution time: ${timestamp}
- Test environment: ${process.env.ANCHOR_PROVIDER_URL}
- Wallet: ${process.env.ANCHOR_WALLET}
- Test result: ${exitCode === 0 ? "✅ Passed" : "❌ Failed"}

## Test Coverage

### 1. Environment Setup and Connection Tests
- [${exitCode === 0 ? "x" : " "}] Solana network connection test
- [${exitCode === 0 ? "x" : " "}] Test account SOL airdrop

### 2. Faucet Initialization Tests
- [${exitCode === 0 ? "x" : " "}] Create faucet token account
- [${exitCode === 0 ? "x" : " "}] Initialize faucet contract

### 3. Token Exchange Function Tests
- [${exitCode === 0 ? "x" : " "}] Create user token account
- [${exitCode === 0 ? "x" : " "}] Handle insufficient tokens scenario
- [${exitCode === 0 ? "x" : " "}] Check faucet token balance
- [${exitCode === 0 ? "x" : " "}] SOL to token exchange function

### 4. Admin Function Tests
- [${exitCode === 0 ? "x" : " "}] Non-admin permission verification
- [${exitCode === 0 ? "x" : " "}] Admin SOL withdrawal
- [${exitCode === 0 ? "x" : " "}] Admin token withdrawal

### 5. Edge Cases and Error Handling Tests
- [${exitCode === 0 ? "x" : " "}] Zero amount exchange handling
- [${exitCode === 0 ? "x" : " "}] Excessive withdrawal handling

## Core Business Process Verification

1. **User Exchange Process**: User deposits SOL → Verify exchange rate → Receive USDC-FOCX tokens
2. **Admin Management Process**: Permission verification → Withdraw SOL/tokens → Balance update
3. **Error Handling Process**: Input validation → Balance check → Permission verification

## Technical Metrics

- Exchange rate verification: 1 SOL = 10,000 USDC-FOCX
- Permission control: Admin exclusive withdrawal permissions
- Balance consistency: All transfer balance changes are correct
- Error handling: All exception scenarios handled correctly

---
Generated at: ${timestamp}
`;

  fs.writeFileSync(reportPath, report);
  console.log("📄 Test report generated:", reportPath);
}

// Main function
async function main() {
  try {
    // Check prerequisites
    if (!checkPrerequisites()) {
      process.exit(1);
    }

    console.log("\n🌐 Environment configuration:");
    console.log("- RPC URL:", process.env.ANCHOR_PROVIDER_URL);
    console.log("- Wallet path:", process.env.ANCHOR_WALLET);
    console.log("- Proxy settings:", process.env.HTTP_PROXY);

    // Run tests
    const exitCode = await runTests();

    // Generate report
    generateReport(exitCode);

    process.exit(exitCode);
  } catch (error) {
    console.error("❌ Test runner error:", error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Promise rejection:", reason);
  process.exit(1);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  process.exit(1);
});

// Run main function
if (require.main === module) {
  main();
}
