import { z } from 'zod';

export const AddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid EVM address format');

export const HashSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid 32-byte hex hash format');

export const RuleConfigSchema = z
  .object({
    enabled: z.boolean(),
    triggerICRPercent: z.number().min(112).max(250),
    targetICRPercent: z.number().min(115).max(300),
    maxTipBps: z.number().int().min(0).max(100),
  })
  .refine((data) => data.targetICRPercent >= data.triggerICRPercent + 5, {
    message: 'Target ICR must be at least 5% higher than Trigger ICR',
    path: ['targetICRPercent'],
  });

export const KeeperConfigSchema = z.object({
  rpcUrl: z.string().url(),
  chainId: z.number().int().positive(),
  keeperPrivateKey: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  pollIntervalMs: z.number().int().min(1000).default(5000),
  minProfitUsd: z.number().min(0).default(1.0),
  telegramBotToken: z.string().optional(),
  telegramChatId: z.string().optional(),
});

export const TroveSnapshotSchema = z.object({
  vault: AddressSchema,
  owner: AddressSchema,
  collateralWei: z.string(),
  debtWei: z.string(),
  icrWei: z.string(),
  icrPercent: z.number(),
  status: z.enum([
    'nonExistent',
    'active',
    'closedByOwner',
    'closedByLiquidation',
    'closedByRedemption',
  ]),
  musdReserveWei: z.string(),
  btcReserveWei: z.string(),
  rule: z.object({
    enabled: z.boolean(),
    triggerICR: z.string(),
    targetICR: z.string(),
    maxTipBps: z.number(),
  }),
  isDefendable: z.boolean(),
});

export const ProtocolAddressesSchema = z.object({
  chainId: z.number().int().positive(),
  borrowerOperations: AddressSchema,
  troveManager: AddressSchema,
  musd: AddressSchema,
  priceFeed: AddressSchema,
  sortedTroves: AddressSchema,
  stabilityPool: AddressSchema,
  activePool: AddressSchema,
  defaultPool: AddressSchema,
  gasPool: AddressSchema,
  collSurplusPool: AddressSchema,
  hintHelpers: AddressSchema,
  borrowerOperationsSignatures: AddressSchema,
  interestRateManager: AddressSchema,
  governableVariables: AddressSchema,
  pcv: AddressSchema,
});

export const DeploymentSchema = z.object({
  chainId: z.number().int().positive(),
  ballastFactory: AddressSchema,
  ballastVaultImplementation: AddressSchema,
  protocol: ProtocolAddressesSchema,
  deployedAtBlock: z.number().int().positive().optional(),
});

export type RuleConfig = z.infer<typeof RuleConfigSchema>;
export type KeeperConfig = z.infer<typeof KeeperConfigSchema>;
export type TroveSnapshot = z.infer<typeof TroveSnapshotSchema>;
export type DeploymentConfig = z.infer<typeof DeploymentSchema>;
