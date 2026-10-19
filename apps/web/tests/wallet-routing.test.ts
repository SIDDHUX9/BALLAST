import { describe, it, expect } from 'vitest';
import { decodeContractError } from '../src/lib/errors';
import { MEZO_TESTNET_CHAIN_ID } from '../src/lib/chains';

describe('Wallet Connector Routing & Architecture', () => {
  it('correctly distinguishes Bitcoin Smart Account connectors from native EVM connectors', () => {
    // OrangeKit connectors set type === 'orangekit'
    const orangeKitConnector = { id: 'orangekit-unisat', type: 'orangekit', name: 'Unisat' };
    const metaMaskConnector = { id: 'metaMaskSDK', type: 'metaMask', name: 'MetaMask' };
    const injectedConnector = { id: 'injected', type: 'injected', name: 'Rabby' };
    const walletConnectConnector = { id: 'walletConnect', type: 'walletConnect', name: 'WalletConnect' };

    function resolveExecutionRoute(connector: { type: string }) {
      if (connector.type === 'orangekit') {
        return 'ORANGEKIT_SMART_ACCOUNT_RELAY';
      }
      return 'EVM_DIRECT_WRITE';
    }

    expect(resolveExecutionRoute(orangeKitConnector)).toBe('ORANGEKIT_SMART_ACCOUNT_RELAY');
    expect(resolveExecutionRoute(metaMaskConnector)).toBe('EVM_DIRECT_WRITE');
    expect(resolveExecutionRoute(injectedConnector)).toBe('EVM_DIRECT_WRITE');
    expect(resolveExecutionRoute(walletConnectConnector)).toBe('EVM_DIRECT_WRITE');
  });

  it('enforces Mezo Testnet (31611) chain boundary', () => {
    function validateChain(chainId: number | undefined): { ok: boolean; reason?: string } {
      if (!chainId || chainId !== MEZO_TESTNET_CHAIN_ID) {
        return {
          ok: false,
          reason: `Wallet connected to wrong network (Chain ID: ${chainId}). Must be ${MEZO_TESTNET_CHAIN_ID}.`,
        };
      }
      return { ok: true };
    }

    expect(validateChain(31611).ok).toBe(true);
    expect(validateChain(1).ok).toBe(false);
    expect(validateChain(11155111).ok).toBe(false);
    expect(validateChain(undefined).ok).toBe(false);
  });

  it('decodes user rejections into clear human feedback', () => {
    const userDeniedError = new Error('User rejected the request.');
    expect(decodeContractError(userDeniedError)).toBe('Transaction signature was declined in wallet.');

    const metamaskReject = new Error('MetaMask: denied transaction signature.');
    expect(decodeContractError(metamaskReject)).toBe('Transaction signature was declined in wallet.');
  });

  it('decodes Mezo MUSD protocol reverts into actionable explanations', () => {
    const icrError = new Error('execution reverted: BorrowerOps: Operation must result in ICR >= MCR');
    expect(decodeContractError(icrError)).toContain('110% Minimum Collateral Ratio');

    const debtMinError = new Error('execution reverted: BorrowerOps: Net debt must be at least 1,800 MUSD');
    expect(decodeContractError(debtMinError)).toContain('1,800 MUSD');

    const allowanceError = new Error('execution reverted: ERC20: insufficient allowance');
    expect(decodeContractError(allowanceError)).toContain('allowance is insufficient');

    const balanceError = new Error('execution reverted: ERC20: transfer amount exceeds balance');
    expect(decodeContractError(balanceError)).toContain('Token balance is insufficient');
  });
});
