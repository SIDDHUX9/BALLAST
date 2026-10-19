import { ProtocolAddresses } from './protocol.js';
import { DeploymentSchema } from './schemas.js';

export interface BallastDeployment {
  chainId: number;
  deployer?: `0x${string}`;
  ballastFactory: `0x${string}`;
  ballastVaultImplementation: `0x${string}`;
  protocol: ProtocolAddresses;
  deployBlockNumber?: number;
  deployedAtBlock?: number;
  txHashes?: {
    ballastVaultImplementation?: `0x${string}`;
    ballastFactory?: `0x${string}`;
    [key: string]: `0x${string}` | undefined;
  };
  compilerSettings?: {
    solc: string;
    evmVersion: string;
    optimizer: boolean;
    runs: number;
  };
  gitCommitHash?: string;
  timestamp?: string;
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
