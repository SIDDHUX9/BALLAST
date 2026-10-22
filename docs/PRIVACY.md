# Ballast Privacy & Telegram Alert Architecture

## Principles

Ballast is designed with a strict non-custodial, zero-identity architecture. Monitoring and alert notifications are built to preserve user privacy and sovereignty without custodial identity, passwords, email addresses, or phone numbers.

---

## 1. Minimal Data Storage

The alert service persists only the absolute minimum metadata required to deliver critical liquidation defense notifications:

| Data Element | Format / Example | Purpose |
| :--- | :--- | :--- |
| **Telegram Chat ID** | Integer / String (`123456789`) | Routing alert messages to the user's Telegram client via the bot. |
| **Wallet Address** | 20-byte Hex (`0x...`) | Binding the Telegram chat to the user's deterministic Ballast Vault. |
| **Watch Level** | Numeric percentage (`150.0%`) | Custom user warning threshold for Individual Collateral Ratio (ICR). |
| **Mute Expiry** | Unix timestamp (milliseconds) | Suppression window for temporary notification silence (`/mute <hours>`). |
| **Link Tokens** | Expiring single-use random string | Ephemeral authorization token valid for 15 minutes during initial pairing. |
| **Signature Nonces** | Random string / timestamp | One-time cryptographic nonces preventing signature replay attacks. |

### What Ballast Never Collects or Stores:
- No passwords or authentication credentials.
- No personal names, usernames, or phone numbers.
- No email addresses or physical location data.
- No private keys, seed phrases, or custodial access.
- No IP addresses, device identifiers, or tracking cookies.

---

## 2. Cryptographic Wallet Verification (EIP-191 & ERC-1271)

To bind a Telegram chat ID to an on-chain vault without passwords:
1. The user generates a single-use, 15-minute expiring link token in the Ballast interface.
2. The user starts the Telegram bot with the deep link (`/start <token>`). The bot associates the incoming chat ID with the pending token.
3. The web dApp asks the user's wallet to sign a human-readable verification message containing:
   - The link token
   - The wallet address
   - A unique nonce
   - An expiration timestamp
4. The backend verifies the signature using `viem` `verifyMessage`:
   - Standard Externally Owned Accounts (EOA) are verified via cryptographic public key recovery (`ecrecover`).
   - Mezo Passport Bitcoin smart accounts are verified on-chain via **ERC-1271** (`isValidSignature`), ensuring full smart contract wallet support.
5. Once verified, the chat ID and wallet address are permanently bound, and the single-use token is marked as consumed.

---

## 3. Data Deletion & Right to Unlink

Users retain unilateral, unconditional control over their data:

- **Via Telegram Bot (`/unlink`)**:
  Executing the `/unlink` command instantly and permanently deletes all stored records associated with the user's chat ID from the keeper's database.

- **Via Web Interface**:
  Users can initiate an unlink request directly from the connected wallet interface. A signed message confirms ownership of the address, prompting the backend to immediately purge all associated chat IDs and alert preferences.

Once unlinked, no background tasks, outbox workers, or monitoring services retain records or history for that chat ID.

---

## 4. Public On-Chain Telemetry

All collateral metrics, Individual Collateral Ratios (ICR), liquidation prices, and reserve capacities are computed directly from public, verified on-chain state via the Mezo network RPC. The keeper service does not intercept, log, or track web browsing behavior.
