/**
 * TEST-ONLY DOUBLE: Burner Key Connector.
 * Strictly forbidden in production code (Rule 2).
 * Only active when NEXT_PUBLIC_E2E === '1' in local testing/test harnesses.
 */

export function getE2EBurnerConnector() {
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_E2E !== '1') {
    throw new Error(
      'FATAL: E2E test doubles are strictly forbidden in production bundles (Rule 2).',
    );
  }

  return {
    name: 'E2E_BURNER_CONNECTOR_DO_NOT_SHIP_TO_PRODUCTION',
    isE2E: true,
  };
}
