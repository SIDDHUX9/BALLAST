import { createConnector } from 'wagmi';

/**
 * E2E Testing Burner Connector.
 * Strictly gated under NEXT_PUBLIC_E2E=1.
 * Must NEVER be included in a production bundle.
 */
export function getE2EBurnerWallet() {
  return () => ({
    id: 'e2e-burner',
    name: 'E2E Burner Wallet',
    iconUrl: 'https://www.svgrepo.com/show/74027/orange.svg',
    iconAccent: '#B8431F',
    iconBackground: '#B8431F',
    installed: true,
    createConnector: () =>
      createConnector(({ emitter }) => ({
        id: 'e2e-burner',
        name: 'E2E Burner (Test Only)',
        type: 'e2e_test_connector',
        marker: 'E2E_BURNER_CONNECTOR_DO_NOT_SHIP_TO_PRODUCTION',
        connect: async () => {
          const accounts = ['0x90F79bf6EB2c4f870365E785982E1f101E93b906' as const];
          emitter.emit('change', { accounts, chainId: 31611 });
          return {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Wagmi connect return type mapping
            accounts: accounts as any,
            chainId: 31611,
          };
        },
        async disconnect() {
          emitter.emit('disconnect');
        },
        async getAccounts() {
          return ['0x90F79bf6EB2c4f870365E785982E1f101E93b906' as const];
        },
        async getChainId() {
          return 31611;
        },
        async getProvider() {
          return null;
        },
        async isAuthorized() {
          return true;
        },
        async switchChain({ chainId }) {
          emitter.emit('change', { chainId });
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Wagmi switchChain returns internal Chain object
          return { id: chainId } as any;
        },
        onAccountsChanged(accounts) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Accounts type mapping
          emitter.emit('change', { accounts: accounts as any });
        },
        onChainChanged(chain) {
          emitter.emit('change', { chainId: Number(chain) });
        },
        onDisconnect() {
          emitter.emit('disconnect');
        },
      })),
  });
}
