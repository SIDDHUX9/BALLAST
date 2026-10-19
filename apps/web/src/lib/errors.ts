/**
 * Decodes contract revert reasons, simulation failures, and wallet errors
 * into human-readable, precise messages.
 */
export function decodeContractError(error: unknown): string {
  if (!error) return 'An unknown error occurred.';

  const errString = error instanceof Error ? error.message : String(error);

  // User rejection
  if (
    errString.includes('User rejected') ||
    errString.includes('User denied') ||
    errString.includes('ACTION_REJECTED') ||
    errString.includes('denied transaction signature') ||
    errString.includes('rejected the request')
  ) {
    return 'Transaction signature was declined in wallet.';
  }

  // Network / Chain errors
  if (errString.includes('ChainMismatchError') || errString.includes('Unsupported chain')) {
    return 'Wallet connected to wrong network. Please switch to Mezo Testnet (Chain ID: 31611).';
  }

  // Gas / Balance errors
  if (errString.includes('insufficient funds') || errString.includes('gas * price + value')) {
    return 'Insufficient native BTC for transaction fee.';
  }

  // MUSD Protocol Reverts
  if (errString.includes('ICR >= MCR') || errString.includes('ICR < MCR')) {
    return 'Operation rejected: collateral ratio would drop below the 110% Minimum Collateral Ratio.';
  }
  if (errString.includes('Trove does not exist or is closed')) {
    return 'Trove is closed or does not exist for this account.';
  }
  if (errString.includes('Trove is already open')) {
    return 'Account already has an active Trove.';
  }
  if (errString.includes('Net debt must be at least') || errString.includes('MIN_NET_DEBT')) {
    return 'Debt amount is below the protocol minimum (1,800 MUSD).';
  }
  if (errString.includes('transfer amount exceeds balance')) {
    return 'Token balance is insufficient for this operation.';
  }
  if (errString.includes('insufficient allowance')) {
    return 'Contract allowance is insufficient. Approval transaction required.';
  }

  // Fallback to error.shortMessage if viem error
  if (typeof error === 'object' && error !== null && 'shortMessage' in error) {
    const short = String((error as { shortMessage: unknown }).shortMessage);
    if (short && short.length > 0 && !short.includes('Execution reverted for an unknown reason')) {
      return short;
    }
  }

  // Clean raw revert string if available
  const match = errString.match(/reverted with the following reason:\s*(.+)/i);
  if (match && match[1]) {
    return match[1].trim();
  }

  return 'Transaction simulation failed on-chain. Please verify inputs and reserve balances.';
}
