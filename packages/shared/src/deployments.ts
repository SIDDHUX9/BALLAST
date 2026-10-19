import { ProtocolAddresses } from './protocol.js';
import { DeploymentSchema } from './schemas.js';

export interface BallastDeployment {
  chainId: number;
  ballastFactory: `0x${string}`;
  ballastVaultImplementation: `0x${string}`;
  protocol: ProtocolAddresses;
  deployedAtBlock?: number;
}

/**
 * Validates and parses raw deployment JSON or object.
 */
export function parseDeployment(input: unknown): BallastDeployment {
  const parsed = DeploymentSchema.parse(input);
  return parsed as unknown as BallastDeployment;
}

/**
 * Parses deployment from raw JSON string.
 */
export function parseDeploymentJson(jsonString: string): BallastDeployment {
  const parsedJson = JSON.parse(jsonString);
  return parseDeployment(parsedJson);
}

// In-memory registry of deployments by chainId
export const DEPLOYMENTS: Record<number, BallastDeployment> = {};

export function registerDeployment(deployment: BallastDeployment): void {
  DEPLOYMENTS[deployment.chainId] = deployment;
}

export function getDeployment(chainId: number): BallastDeployment | undefined {
  return DEPLOYMENTS[chainId];
}
