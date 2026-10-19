import { describe, it, expect } from 'vitest';
import { parseDeploymentJson, registerDeployment, getDeployment } from '../src/deployments.js';
import { MATSNET_PROTOCOL_ADDRESSES } from '../src/protocol.js';

describe('Deployments Loader', () => {
  it('parses valid deployment JSON correctly', () => {
    const validJson = JSON.stringify({
      chainId: 31611,
      ballastFactory: '0x1111111111111111111111111111111111111111',
      ballastVaultImplementation: '0x2222222222222222222222222222222222222222',
      protocol: MATSNET_PROTOCOL_ADDRESSES,
      deployedAtBlock: 1234567,
    });

    const deployment = parseDeploymentJson(validJson);
    expect(deployment.chainId).toBe(31611);
    expect(deployment.ballastFactory).toBe('0x1111111111111111111111111111111111111111');
    expect(deployment.deployedAtBlock).toBe(1234567);
  });

  it('rejects invalid deployment structure', () => {
    const invalidJson = JSON.stringify({
      chainId: 31611,
      ballastFactory: 'not-an-address',
    });

    expect(() => parseDeploymentJson(invalidJson)).toThrow();
  });

  it('registers and retrieves deployment by chainId', () => {
    const deployment = {
      chainId: 31611,
      ballastFactory: '0x1111111111111111111111111111111111111111' as `0x${string}`,
      ballastVaultImplementation: '0x2222222222222222222222222222222222222222' as `0x${string}`,
      protocol: MATSNET_PROTOCOL_ADDRESSES,
    };

    registerDeployment(deployment);
    expect(getDeployment(31611)).toEqual(deployment);
    expect(getDeployment(1)).toBeUndefined();
  });
});
