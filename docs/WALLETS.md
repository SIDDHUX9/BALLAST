# Wallet Compatibility Matrix & Testing Guide

This document tracks empirical compatibility testing for wallets on the Mezo Testnet (Matsnet, Chain ID `31611`) within Ballast.

Per **AGENTS.md Rule 1** (No Mocks) and **Rule 6** (Honest Execution & Verification Reporting), all cells in this matrix reflect **strictly verified observations**. Any action not yet empirically executed and verified in an active browser session with live extensions is marked as **untested**. Never guess or assume compatibility.

---

## Compatibility Matrix

| Wallet | Type | Connect | Switch Network | Sign Message | Send BTC Tx | Contract Write | Notes / Verification Method |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **MetaMask** | EVM | untested | untested | untested | untested | untested | Pending manual run with script below |
| **Rabby** | EVM | untested | untested | untested | untested | untested | Pending manual run |
| **Coinbase Wallet** | EVM | untested | untested | untested | untested | untested | Pending manual run |
| **Rainbow** | EVM | untested | untested | untested | untested | untested | Pending manual run |
| **WalletConnect** | EVM | untested | untested | untested | untested | untested | Requires mobile/external session scan |
| **UniSat** | Bitcoin (Smart Account) | untested | untested | untested | untested | untested | Pending manual run with script below |
| **OKX** | Bitcoin (Smart Account) | untested | untested | untested | untested | untested | Pending manual run |
| **Xverse** | Bitcoin (Smart Account) | untested | untested | untested | untested | untested | Pending manual run |
| **Burner Connector** *(E2E Only)* | Mock EVM | **PASSED** | **PASSED** | untested | untested | **PASSED** | Verified via Vitest (`wallet-routing.test.ts`) & E2E harness (`NEXT_PUBLIC_E2E=1`) |

---

## Dual Architecture Reference

### 1. EVM Wallets
- **Connection**: Standard EIP-1193 injected provider via Wagmi v2 / RainbowKit.
- **On-Chain Sender (`msg.sender`)**: User's EVM EOA address.
- **Execution Route**: Pre-flight simulation via `publicClient.simulateContract` followed by `useWriteContract`.

### 2. Bitcoin Wallets (Mezo Passport / OrangeKit)
- **Supported Wallets**: UniSat, OKX, Xverse.
- **On-Chain Sender (`msg.sender`)**: An ERC-4337 Smart Account deployed on Mezo, tied to the user's Bitcoin wallet public key.
- **Execution Route**: Pre-flight simulation via `publicClient.simulateContract` using the smart account address as `account`, then relayed via Mezo's relayer using OrangeKit `useSendTransaction`.

---

## Numbered Manual Test Scripts

Per **Rule 8 (Human Escalation Protocol)**, verifying interactive browser extension popups requires human execution. Use the following scripts to test MetaMask and UniSat on `http://localhost:3000/app/wallet-check`.

### Test Script A: MetaMask (EVM)

**Prerequisites**:
1. Chrome/Brave/Firefox with MetaMask extension installed.
2. Dev server running (`pnpm --filter @ballast/web dev` on `http://localhost:3000`).
3. Some testnet BTC on Mezo Testnet (request from [faucet.test.mezo.org](https://faucet.test.mezo.org) if needed).

**Steps**:
1. **Connect**:
   - Navigate to `http://localhost:3000/app/wallet-check`.
   - Click the **Connect Wallet** button in the header.
   - Select **MetaMask** under "EVM wallets".
   - Approve the connection in the MetaMask popup.
   - *Verification*: Verify the header shows your truncated address chip and the network chip displays "Mezo Testnet". In `/app/wallet-check`, verify "Connected Account (msg.sender)" matches your MetaMask address, and "Wallet Architecture" displays `EVM Wallet`.
2. **Switch Network**:
   - In MetaMask, manually switch your active network to Ethereum Mainnet or Sepolia.
   - *Verification*: Verify a sticky warning banner appears: *"Connected to unsupported chain. Ballast requires Mezo Testnet (Chain ID 31611)."*
   - Click **Switch to Mezo Testnet** button on the banner.
   - Approve the network switch in MetaMask.
   - *Verification*: Verify the banner dismisses and network returns to "Mezo Testnet".
3. **Account Modal & Faucet Link**:
   - Click your address chip in the header to open the Account Modal.
   - *Verification*: Verify the modal displays:
     - Your address with copy button and Explorer link.
     - Badge: `EVM Wallet`.
     - Live Native BTC Balance on Mezo.
     - Live MUSD Balance.
     - "Get testnet BTC" button opening `https://faucet.test.mezo.org`.
4. **On-Chain Read**:
   - On `/app/wallet-check`, inspect the "Live Protocol Reads (Mezo Testnet)" card.
   - *Verification*: Verify MUSD Balance, Trove Status, Collateral (BTC), Debt (MUSD), and Current ICR load without error directly from the on-chain contracts.
5. **Contract Write (Simulation & Write)**:
   - In the "Empirical Contract Write Test" card on `/app/wallet-check`, click **Test Approve (1 MUSD)**.
   - *Verification*:
     - Verify status transitions to `simulating`, then `awaiting_signature`.
     - Approve the ERC20 `approve(spender, 1 MUSD)` transaction in MetaMask.
     - Verify status transitions to `submitted` with transaction hash, then `confirmed`.
6. **Revert Decoding**:
   - Click **Trigger Test Revert (Invalid Repay)**.
   - *Verification*: Verify the hook halts *before* prompting a wallet signature, intercepts the simulated revert, and displays the decoded reason (e.g., Min net debt violation or Trove does not exist).
7. **Disconnect**:
   - Open the Account Modal and click **Disconnect**.
   - *Verification*: Verify the application returns to the disconnected state.

---

### Test Script B: UniSat Wallet (Bitcoin via Mezo Smart Account)

**Prerequisites**:
1. Chrome/Brave with UniSat Wallet extension installed.
2. UniSat configured to testnet mode (or signet).
3. Dev server running (`pnpm --filter @ballast/web dev` on `http://localhost:3000`).

**Steps**:
1. **Connect**:
   - Navigate to `http://localhost:3000/app/wallet-check`.
   - Click **Connect Wallet** in the header.
   - Select **UniSat** under "Bitcoin wallets".
   - Approve the connection prompt in the UniSat popup.
   - *Verification*:
     - Verify the header displays the connected address chip.
     - In `/app/wallet-check`, verify "Wallet Architecture" displays `Bitcoin Wallet (Mezo Smart Account)`.
     - Verify "Connected Account (msg.sender)" shows the `0x...` Mezo Smart Account address, and "Native Bitcoin Signer Address" displays your `bc1...` / `tb1...` UniSat address.
2. **Account Modal Inspection**:
   - Click the address chip to open the Account Modal.
   - *Verification*:
     - Verify badge: `Bitcoin wallet via Mezo smart account`.
     - Verify both the Mezo smart account address and the Bitcoin signer address are visible.
     - Verify Native BTC and MUSD balances load for the smart account.
3. **On-Chain Read**:
   - In `/app/wallet-check`, verify live protocol reads load for the smart account address.
4. **Contract Write**:
   - In the "Empirical Contract Write Test" card, click **Test Approve (1 MUSD)**.
   - *Verification*: Verify UniSat displays a signature request to authorize the Mezo relay transaction. Confirm signature and observe transition to `submitted` and `confirmed`.
5. **Disconnect**:
   - Open Account Modal and click **Disconnect**.

---

## Reporting Results

When manual testing is completed, reply with:
```
MetaMask:
- Connect: [PASSED / FAILED]
- Switch Network: [PASSED / FAILED]
- Sign Message: [PASSED / FAILED]
- Send BTC Tx: [PASSED / FAILED]
- Contract Write: [PASSED / FAILED]

UniSat:
- Connect: [PASSED / FAILED]
- Switch Network: [PASSED / FAILED]
- Sign Message: [PASSED / FAILED]
- Send BTC Tx: [PASSED / FAILED]
- Contract Write: [PASSED / FAILED]
```
The results will immediately be recorded in the matrix above.
