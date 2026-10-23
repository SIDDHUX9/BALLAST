'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useAccount, usePublicClient, useSwitchChain } from 'wagmi';
import { formatEther, parseEther } from 'viem';
import {
  BallastFactoryAbi,
  BallastVaultAbi,
  MusdAbi,
  MATSNET_PROTOCOL_ADDRESSES,
  computeICR,
  computeLiquidationPrice,
  computeAbsorptionCapacity,
  PRECISION,
} from '@ballast/shared';
import {
  useVault,
  usePosition,
  useRule,
  useReserves,
  useProtocolParams,
  useBallastWrite,
  FACTORY_ADDRESS,
} from '../../hooks';
import { computeInsertHints } from '../../lib/hints';
import { MEZO_TESTNET_CHAIN_ID } from '../../lib/chains';
import { Stepper, type Step } from '../../components/ui/stepper';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Slider } from '../../components/ui/slider';
import { HealthGauge } from '../../components/ui/health-gauge';
import { StatusBadge } from '../../components/ui/status-badge';
import { TxStatus } from '../../components/ui/tx-status';
import { Banner } from '../../components/ui/banner';
import { EmptyState } from '../../components/ui/empty-state';
import { WalletButton } from '../../components/wallet/wallet-button';
import {
  Shield,
  ShieldCheck,
  ExternalLink,
  Wallet,
  Lock,
} from 'lucide-react';

const WIZARD_STEPS: Step[] = [
  { title: '1. Create Vault', description: 'Deploy your personal proxy' },
  { title: '2. Open Trove', description: 'Deposit BTC & borrow MUSD' },
  { title: '3. Protection Rule', description: 'Configure safety thresholds' },
  { title: '4. Fund Reserves', description: 'Deposit defense buffer' },
  { title: '5. Review & Arm', description: 'Activate automated defense' },
];

export default function OnboardingWizardPage() {
  const { address, isConnected, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const publicClient = usePublicClient();

  // On-Chain Data Hooks
  const vault = useVault(address);
  const position = usePosition(vault.vaultAddress);
  const rule = useRule(vault.vaultAddress);
  const protocol = useProtocolParams();
  const reserves = useReserves({
    vaultAddress: vault.vaultAddress,
    collateral: position.collateral,
    debt: position.debt,
    price: position.price,
    targetICR: rule.targetICR,
  });

  // Universal Transaction Writer
  const writeHook = useBallastWrite();

  // Active Wizard Step (1 to 5)
  const [activeStep, setActiveStep] = useState<number>(1);
  const [stepOverridden, setStepOverridden] = useState<boolean>(false);

  // Automatically derive step based on live on-chain state if user has not manually stepped
  useEffect(() => {
    if (stepOverridden) return;

    if (!vault.exists) {
      setActiveStep(1);
    } else if (position.status !== 'active') {
      setActiveStep(2);
    } else if (!rule.triggerICR || rule.triggerICR === 0n) {
      setActiveStep(3);
    } else if (
      (reserves.musdReserve === null || reserves.musdReserve === 0n) &&
      (reserves.btcReserve === null || reserves.btcReserve === 0n)
    ) {
      setActiveStep(4);
    } else {
      setActiveStep(5);
    }
  }, [
    vault.exists,
    position.status,
    rule.triggerICR,
    reserves.musdReserve,
    reserves.btcReserve,
    stepOverridden,
  ]);

  // Form State: Step 2 (Open Trove)
  const [collateralInput, setCollateralInput] = useState<string>('0.05');
  const [borrowInput, setBorrowInput] = useState<string>('2000');
  const [borrowFeePreview, setBorrowFeePreview] = useState<bigint>(0n);

  // Form State: Step 3 (Protection Rule)
  const [triggerPercent, setTriggerPercent] = useState<number>(125);
  const [targetPercent, setTargetPercent] = useState<number>(140);
  const tipBps = 50; // 0.50%

  // Form State: Step 4 (Reserves)
  const [musdDepositInput, setMusdDepositInput] = useState<string>('500');
  const [btcDepositInput, setBtcDepositInput] = useState<string>('0.01');
  const [approveBuffer, setApproveBuffer] = useState<boolean>(false);

  // Fetch live fee preview when borrow input changes
  useEffect(() => {
    let active = true;
    const fetchFee = async () => {
      try {
        const val = parseFloat(borrowInput);
        if (isNaN(val) || val <= 0) return;
        const wei = parseEther(val.toString());
        const fee = await protocol.getBorrowingFee(wei);
        if (active) setBorrowFeePreview(fee);
      } catch {
        // ignore
      }
    };
    fetchFee();
    return () => {
      active = false;
    };
  }, [borrowInput, protocol]);

  // Derived Position Calculations for Step 2
  const step2Metrics = useMemo(() => {
    const collFloat = parseFloat(collateralInput);
    const borrowFloat = parseFloat(borrowInput);
    const price = position.price ?? 0n;

    if (isNaN(collFloat) || isNaN(borrowFloat) || collFloat <= 0 || borrowFloat <= 0 || price === 0n) {
      return null;
    }

    const collWei = parseEther(collateralInput);
    const netDebtWei = parseEther(borrowInput);
    const gasCompWei = protocol.gasCompensation;
    const grossDebtWei = netDebtWei + borrowFeePreview + gasCompWei;

    const resultingICR = computeICR(collWei, grossDebtWei, price);
    const resultingICRPct = Number((resultingICR * 10000n) / PRECISION) / 100;
    const liqPrice = computeLiquidationPrice(collWei, grossDebtWei, protocol.mcr);

    const isBelowMcr = resultingICRPct < protocol.mcrPercent;
    const isBelowMinNetDebt = netDebtWei < protocol.minNetDebt;
    const isCaution = resultingICRPct >= protocol.mcrPercent && resultingICRPct < protocol.ccrPercent;

    return {
      collWei,
      netDebtWei,
      grossDebtWei,
      resultingICR,
      resultingICRPct,
      liqPrice,
      isBelowMcr,
      isBelowMinNetDebt,
      isCaution,
    };
  }, [collateralInput, borrowInput, borrowFeePreview, position.price, protocol]);

  // Step 4 Reserve Deposit Previews
  const step4CapacityPreview = useMemo(() => {
    const musdDeposit = parseFloat(musdDepositInput);
    const btcDeposit = parseFloat(btcDepositInput);
    const price = position.price;
    const coll = position.collateral;
    const debt = position.debt;
    const target = rule.targetICR ?? parseEther('1.40');

    if (!price || !coll || !debt) return null;

    const addedMusd = !isNaN(musdDeposit) && musdDeposit > 0 ? parseEther(musdDeposit.toString()) : 0n;
    const addedBtc = !isNaN(btcDeposit) && btcDeposit > 0 ? parseEther(btcDeposit.toString()) : 0n;

    const totalMusdReserve = (reserves.musdReserve ?? 0n) + addedMusd;
    const totalBtcReserve = (reserves.btcReserve ?? 0n) + addedBtc;

    return computeAbsorptionCapacity(
      coll,
      debt,
      price,
      target,
      totalMusdReserve,
      totalBtcReserve,
      protocol.minNetDebt,
    );
  }, [musdDepositInput, btcDepositInput, position, rule.targetICR, reserves, protocol.minNetDebt]);

  // Step 1 Handler: Deploy Personal Vault
  const handleCreateVault = async () => {
    await writeHook.writeAsync({
      address: FACTORY_ADDRESS,
      abi: BallastFactoryAbi,
      functionName: 'createVault',
    });
    vault.refetch();
  };

  // Step 2 Handler: Open Trove
  const handleOpenTrove = async () => {
    if (!publicClient || !vault.vaultAddress || !step2Metrics) return;

    // 0.5% max borrowing fee slippage tolerance
    const maxFeePercentage = parseEther('0.05'); // 5% max fee
    const musdAmount = step2Metrics.netDebtWei;
    const btcAmount = step2Metrics.collWei;

    // Compute SortedTroves insert hints
    const hints = await computeInsertHints(publicClient, btcAmount, step2Metrics.grossDebtWei);

    await writeHook.writeAsync({
      address: vault.vaultAddress,
      abi: BallastVaultAbi,
      functionName: 'openTrove',
      args: [maxFeePercentage, musdAmount, hints.upperHint, hints.lowerHint],
      value: btcAmount,
    });

    position.refetch();
  };

  // Step 3 Handler: Set Rule
  const handleSetRule = async () => {
    if (!vault.vaultAddress) return;

    const triggerICR = parseEther((triggerPercent / 100).toString());
    const targetICR = parseEther((targetPercent / 100).toString());

    await writeHook.writeAsync({
      address: vault.vaultAddress,
      abi: BallastVaultAbi,
      functionName: 'setRule',
      args: [true, triggerICR, targetICR, tipBps],
    });

    rule.refetch();
  };

  // Step 4 Handler: Approve MUSD
  const handleApproveMusd = async () => {
    if (!vault.vaultAddress) return;
    const depositAmount = parseFloat(musdDepositInput);
    if (isNaN(depositAmount) || depositAmount <= 0) return;

    const amountWei = approveBuffer
      ? parseEther('1000000000') // large buffer
      : parseEther(depositAmount.toString());

    await writeHook.writeAsync({
      address: MATSNET_PROTOCOL_ADDRESSES.musd,
      abi: MusdAbi,
      functionName: 'approve',
      args: [vault.vaultAddress, amountWei],
    });

    reserves.refetch();
  };

  // Step 4 Handler: Deposit Reserves
  const handleDepositReserves = async () => {
    if (!vault.vaultAddress) return;
    const musdDeposit = parseFloat(musdDepositInput);
    const btcDeposit = parseFloat(btcDepositInput);

    const musdWei = !isNaN(musdDeposit) && musdDeposit > 0 ? parseEther(musdDeposit.toString()) : 0n;
    const btcWei = !isNaN(btcDeposit) && btcDeposit > 0 ? parseEther(btcDeposit.toString()) : 0n;

    await writeHook.writeAsync({
      address: vault.vaultAddress,
      abi: BallastVaultAbi,
      functionName: 'depositReserves',
      args: [musdWei],
      value: btcWei,
    });

    reserves.refetch();
  };

  // Step 5 Handler: Arm / Toggle Protection
  const handleArmProtection = async () => {
    if (!vault.vaultAddress) return;
    const triggerICR = rule.triggerICR ?? parseEther('1.25');
    const targetICR = rule.targetICR ?? parseEther('1.40');
    const tip = rule.maxTipBps ?? 50;

    await writeHook.writeAsync({
      address: vault.vaultAddress,
      abi: BallastVaultAbi,
      functionName: 'setRule',
      args: [true, triggerICR, targetICR, tip],
    });

    rule.refetch();
  };

  // 1. Disconnected State
  if (!isConnected) {
    return (
      <div className="space-y-8">
        <div className="border-b border-hairline pb-4">
          <span className="text-xs font-mono uppercase tracking-wider text-ink-muted">
            Onboarding Wizard
          </span>
          <h1 className="text-2xl font-serif font-bold text-ink">Set Up Ballast Guardian</h1>
        </div>

        <EmptyState
          icon={<Wallet className="w-8 h-8 stroke-[1.5]" />}
          title="Connect Wallet to Begin Setup"
          description="Ballast deploys an autonomous personal vault that protects your MUSD trove. Connect your Mezo or Bitcoin wallet to begin."
          action={<WalletButton />}
        />
      </div>
    );
  }

  // 2. Wrong Network State
  if (chainId !== MEZO_TESTNET_CHAIN_ID) {
    return (
      <div className="space-y-8">
        <Banner
          variant="warning"
          title="Unsupported Network"
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => switchChain?.({ chainId: MEZO_TESTNET_CHAIN_ID })}
            >
              Switch to Mezo Testnet
            </Button>
          }
        >
          Ballast operates strictly on Mezo Testnet (Matsnet, Chain ID 31611). Please switch your network to continue.
        </Banner>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Top Banner & Title */}
      <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-hairline pb-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-ink-muted">
            Onboarding & Protection Setup
          </span>
          <h1 className="text-2xl font-serif font-bold text-ink">Ballast Guardian Wizard</h1>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/app/overview">
            <Button variant="quiet" size="sm" className="text-xs font-mono">
              View Dashboard →
            </Button>
          </Link>
          <div className="flex items-center gap-2 text-xs font-mono text-ink-muted border border-hairline px-2.5 py-1 rounded-sm bg-paper-surface">
            <span className="w-2 h-2 rounded-full bg-safe" />
            <span>Mezo Matsnet (31611)</span>
          </div>
        </div>
      </div>

      {/* Stepper Navigation */}
      <div className="p-4 bg-paper-raised border border-hairline rounded-sm">
        <Stepper
          steps={WIZARD_STEPS}
          currentStep={activeStep}
          className="cursor-pointer"
        />
      </div>

      {/* Transaction Status & Error Alerts */}
      {writeHook.txHash && (
        <TxStatus
          status={writeHook.isSuccess ? 'confirmed' : writeHook.isError ? 'failed' : 'pending'}
          hash={writeHook.txHash}
        />
      )}

      {writeHook.error && (
        <Banner
          variant="danger"
          title="Transaction Failed"
          action={
            <Button variant="secondary" size="sm" onClick={() => writeHook.reset()}>
              Dismiss
            </Button>
          }
        >
          {writeHook.error}
        </Banner>
      )}

      {/* STEP 1: CREATE VAULT */}
      {activeStep === 1 && (
        <div className="border border-hairline bg-paper-surface p-6 rounded-sm space-y-6">
          <div className="border-b border-hairline pb-3">
            <span className="text-xs font-mono uppercase text-ember font-semibold tracking-wider">
              Step 1 of 5
            </span>
            <h2 className="text-xl font-serif font-bold text-ink mt-0.5">Deploy Personal Vault</h2>
            <p className="text-sm font-sans text-ink-muted mt-1 leading-relaxed">
              Because Mezo BorrowerOperations requires the borrower to be the transaction sender,
              Ballast assigns an immutable, per-user smart contract proxy (
              <span className="font-mono text-ink">BallastVault</span>) that you exclusively own.
              It opens your MUSD trove and safely stores your pre-funded defense reserves.
            </p>
          </div>

          <div className="p-4 border border-hairline bg-paper rounded-sm space-y-3 font-mono text-xs">
            <div className="flex justify-between items-center text-ink-muted">
              <span>Owner Account (You):</span>
              <span className="text-ink font-semibold">{address}</span>
            </div>
            <div className="flex justify-between items-center text-ink-muted">
              <span>Predicted Deterministic Address:</span>
              <span className="text-ink font-semibold">
                {vault.predictedAddress ?? 'Calculating via CREATE2…'}
              </span>
            </div>
            <div className="flex justify-between items-center text-ink-muted">
              <span>Vault Factory:</span>
              <span className="text-ink">{FACTORY_ADDRESS}</span>
            </div>
          </div>

          {vault.exists ? (
            <div className="p-4 border border-safe/30 bg-safe/10 rounded-sm flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-safe text-sm font-mono font-semibold">
                <ShieldCheck className="w-5 h-5 stroke-[2]" />
                <span>Vault deployed and ready: {vault.vaultAddress}</span>
              </div>
              <Button
                variant="primary"
                onClick={() => {
                  setStepOverridden(true);
                  setActiveStep(2);
                }}
              >
                Proceed to Open Trove →
              </Button>
            </div>
          ) : (
            <div className="pt-2 flex items-center gap-4">
              <Button
                variant="primary"
                onClick={handleCreateVault}
                disabled={writeHook.isPending}
                loading={writeHook.isPending}
              >
                {writeHook.status === 'simulating'
                  ? 'Simulating Deployment…'
                  : writeHook.status === 'awaiting_signature'
                    ? 'Confirm in Wallet…'
                    : 'Deploy Personal Vault'}
              </Button>
              <span className="text-xs font-mono text-ink-muted">
                Requires 1 Mezo transaction • Zero deployment fee
              </span>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: OPEN TROVE */}
      {activeStep === 2 && (
        <div className="border border-hairline bg-paper-surface p-6 rounded-sm space-y-6">
          <div className="border-b border-hairline pb-3">
            <span className="text-xs font-mono uppercase text-ember font-semibold tracking-wider">
              Step 2 of 5
            </span>
            <h2 className="text-xl font-serif font-bold text-ink mt-0.5">Open MUSD Trove</h2>
            <p className="text-sm font-sans text-ink-muted mt-1 leading-relaxed">
              Deposit native Bitcoin collateral to borrow MUSD stablecoin. Live parameters and risk
              metrics are derived directly from Mezo testnet PriceFeed and TroveManager.
            </p>
          </div>

          {position.status === 'active' ? (
            <div className="p-4 border border-safe/30 bg-safe/10 rounded-sm space-y-3">
              <div className="flex items-center gap-2 text-safe text-sm font-mono font-semibold">
                <ShieldCheck className="w-5 h-5 stroke-[2]" />
                <span>Trove is active on Mezo testnet</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
                <div>
                  <span className="text-ink-muted">Collateral:</span>{' '}
                  <span className="font-semibold text-ink">
                    {Number(formatEther(position.collateral ?? 0n)).toFixed(4)} BTC
                  </span>
                </div>
                <div>
                  <span className="text-ink-muted">Total Debt:</span>{' '}
                  <span className="font-semibold text-ink">
                    {Number(formatEther(position.debt ?? 0n)).toLocaleString(undefined, { maximumFractionDigits: 2 })}{' '}
                    MUSD
                  </span>
                </div>
                <div>
                  <span className="text-ink-muted">Live ICR:</span>{' '}
                  <span className="font-semibold text-safe">
                    {position.icrPercent ? `${position.icrPercent.toFixed(1)}%` : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-ink-muted">Liquidation:</span>{' '}
                  <span className="font-semibold text-ink">
                    ${Number(formatEther(position.liquidationPrice ?? 0n)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
              <Button
                variant="primary"
                onClick={() => {
                  setStepOverridden(true);
                  setActiveStep(3);
                }}
              >
                Proceed to Protection Rule →
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="BTC Collateral to Deposit"
                  unit="BTC"
                  value={collateralInput}
                  onChange={(e) => setCollateralInput(e.target.value)}
                  placeholder="0.05"
                  helperText="Transferred directly into your BallastVault and forwarded to BorrowerOperations"
                />

                <Input
                  label="MUSD Debt to Borrow"
                  unit="MUSD"
                  value={borrowInput}
                  onChange={(e) => setBorrowInput(e.target.value)}
                  placeholder="2000"
                  helperText={`Protocol minimum net debt: ${Number(formatEther(protocol.minNetDebt)).toLocaleString()} MUSD`}
                />
              </div>

              {/* Live Preview Panel */}
              {step2Metrics && (
                <div className="p-4 border border-hairline bg-paper rounded-sm space-y-3 font-mono text-xs">
                  <div className="flex justify-between items-center text-ink-muted">
                    <span>Current BTC Price (Mezo PriceFeed):</span>
                    <span className="text-ink font-semibold">
                      ${Number(formatEther(position.price ?? 0n)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-ink-muted">
                    <span>Borrowing Fee (0.5%):</span>
                    <span className="text-ink">
                      +{Number(formatEther(borrowFeePreview)).toFixed(2)} MUSD
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-ink-muted">
                    <span>Liquidation Reserve (Gas Compensation):</span>
                    <span className="text-ink">
                      +{Number(formatEther(protocol.gasCompensation)).toFixed(0)} MUSD
                    </span>
                  </div>

                  <div className="flex justify-between items-center border-t border-hairline pt-2 text-ink-muted font-semibold">
                    <span>Total Gross Debt:</span>
                    <span className="text-ink text-sm">
                      {Number(formatEther(step2Metrics.grossDebtWei)).toFixed(2)} MUSD
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-ink-muted">
                    <span>Resulting ICR:</span>
                    <span
                      className={`text-sm font-bold ${
                        step2Metrics.isBelowMcr
                          ? 'text-danger'
                          : step2Metrics.isCaution
                            ? 'text-watch'
                            : 'text-safe'
                      }`}
                    >
                      {step2Metrics.resultingICRPct.toFixed(1)}%
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-ink-muted">
                    <span>Estimated Liquidation Price:</span>
                    <span className="text-ink font-semibold">
                      ${Number(formatEther(step2Metrics.liqPrice)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              )}

              {/* Warnings and Blocking Conditions */}
              {step2Metrics?.isBelowMcr && (
                <Banner variant="danger" title="Collateral Ratio Below Minimum (MCR)">
                  Initial collateral ratio must be strictly above 110% MCR. Please increase BTC collateral or decrease MUSD borrowed.
                </Banner>
              )}

              {step2Metrics?.isBelowMinNetDebt && (
                <Banner variant="danger" title="Below Minimum Net Debt">
                  {`Mezo protocol requires a minimum net debt of ${Number(formatEther(protocol.minNetDebt)).toLocaleString()} MUSD. Increase borrow amount to proceed.`}
                </Banner>
              )}

              {step2Metrics?.isCaution && (
                <Banner variant="warning" title="Caution: ICR below 150% CCR">
                  While above the 110% liquidation threshold, troves under 150% CCR are subject to liquidation if the system enters Recovery Mode. Ballast automated defense is highly recommended.
                </Banner>
              )}

              <div className="pt-2 flex items-center gap-4">
                <Button
                  variant="primary"
                  onClick={handleOpenTrove}
                  disabled={
                    writeHook.isPending ||
                    !step2Metrics ||
                    step2Metrics.isBelowMcr ||
                    step2Metrics.isBelowMinNetDebt
                  }
                  loading={writeHook.isPending}
                >
                  {writeHook.status === 'simulating'
                    ? 'Simulating openTrove…'
                    : writeHook.status === 'awaiting_signature'
                      ? 'Confirm in Wallet…'
                      : 'Open MUSD Trove'}
                </Button>
                <Button
                  variant="quiet"
                  onClick={() => {
                    setStepOverridden(true);
                    setActiveStep(1);
                  }}
                >
                  ← Back to Step 1
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 3: SET PROTECTION RULE */}
      {activeStep === 3 && (
        <div className="border border-hairline bg-paper-surface p-6 rounded-sm space-y-6">
          <div className="border-b border-hairline pb-3">
            <span className="text-xs font-mono uppercase text-ember font-semibold tracking-wider">
              Step 3 of 5
            </span>
            <h2 className="text-xl font-serif font-bold text-ink mt-0.5">Configure Protection Rule</h2>
            <p className="text-sm font-sans text-ink-muted mt-1 leading-relaxed">
              Define the exact safety envelope for your trove. When your ICR drops below your trigger
              threshold, permissionless keepers can deploy your pre-funded reserve to restore health.
            </p>
          </div>

          <div className="space-y-6">
            <HealthGauge
              current={position.icrPercent}
              trigger={triggerPercent}
              target={targetPercent}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="space-y-2">
                <Slider
                  label="Trigger ICR (Defense threshold)"
                  value={[triggerPercent]}
                  onValueChange={(val) => setTriggerPercent(val[0])}
                  min={115}
                  max={150}
                  step={1}
                  unit="%"
                />
                <span className="text-xs font-mono text-ink-muted">
                  Keeper will act as soon as ICR drops below this level.
                </span>
              </div>

              <div className="space-y-2">
                <Slider
                  label="Target ICR (Restored threshold)"
                  value={[targetPercent]}
                  onValueChange={(val) => setTargetPercent(val[0])}
                  min={130}
                  max={200}
                  step={1}
                  unit="%"
                />
                <span className="text-xs font-mono text-ink-muted">
                  Reserve will be deployed to restore ICR to this healthy level.
                </span>
              </div>
            </div>

            <div className="p-4 border border-hairline bg-paper rounded-sm space-y-2">
              <span className="text-xs font-mono uppercase text-ink-muted font-semibold tracking-wider">
                Plain-Language Consequence
              </span>
              <p className="text-sm font-serif text-ink italic leading-relaxed">
                “If your ratio falls below{' '}
                <strong className="text-ember not-italic font-mono">{triggerPercent.toFixed(1)}%</strong>,
                anyone can repay debt or add collateral from your reserve until it reaches{' '}
                <strong className="text-safe not-italic font-mono">{targetPercent.toFixed(1)}%</strong>{' '}
                (paying a{' '}
                <strong className="text-ink not-italic font-mono">{(tipBps / 100).toFixed(2)}%</strong>{' '}
                tip to the keeper in the asset deployed).”
              </p>
            </div>

            <div className="pt-2 flex items-center gap-4">
              <Button
                variant="primary"
                onClick={handleSetRule}
                disabled={writeHook.isPending || triggerPercent >= targetPercent}
                loading={writeHook.isPending}
              >
                {writeHook.status === 'simulating'
                  ? 'Simulating setRule…'
                  : writeHook.status === 'awaiting_signature'
                    ? 'Confirm in Wallet…'
                    : 'Save Protection Rule'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setStepOverridden(true);
                  setActiveStep(4);
                }}
              >
                Skip / Proceed to Step 4 →
              </Button>
              <Button
                variant="quiet"
                onClick={() => {
                  setStepOverridden(true);
                  setActiveStep(2);
                }}
              >
                ← Back
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: FUND RESERVES */}
      {activeStep === 4 && (
        <div className="border border-hairline bg-paper-surface p-6 rounded-sm space-y-6">
          <div className="border-b border-hairline pb-3">
            <span className="text-xs font-mono uppercase text-ember font-semibold tracking-wider">
              Step 4 of 5
            </span>
            <h2 className="text-xl font-serif font-bold text-ink mt-0.5">Fund Defense Reserves</h2>
            <p className="text-sm font-sans text-ink-muted mt-1 leading-relaxed">
              Deposit MUSD and native BTC into your personal vault. Funds remain completely in your
              vault and under your sole custody until a keeper deploys them to defend your position.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="MUSD Reserve to Deposit"
              unit="MUSD"
              value={musdDepositInput}
              onChange={(e) => setMusdDepositInput(e.target.value)}
              placeholder="500"
              helperText={`Your wallet balance: ${Number(formatEther(reserves.userMusdBalance ?? 0n)).toFixed(2)} MUSD`}
            />

            <Input
              label="BTC Reserve to Deposit"
              unit="BTC"
              value={btcDepositInput}
              onChange={(e) => setBtcDepositInput(e.target.value)}
              placeholder="0.01"
              helperText={`Your wallet balance: ${Number(formatEther(reserves.userBtcBalance ?? 0n)).toFixed(4)} BTC`}
            />
          </div>

          {/* Defense Capacity Statement */}
          {step4CapacityPreview && (
            <div className="p-4 border border-safe/30 bg-safe/10 rounded-sm space-y-2">
              <span className="text-xs font-mono uppercase text-safe font-semibold tracking-wider flex items-center gap-1.5">
                <Shield className="w-4 h-4 stroke-[2]" />
                Computed Defense Capacity
              </span>
              <p className="text-sm font-serif text-ink italic leading-relaxed">
                “With these reserves, a further{' '}
                <strong className="text-safe not-italic font-mono text-base">
                  {step4CapacityPreview.absorbableDropPercent.toFixed(1)}%
                </strong>{' '}
                drop in the Bitcoin price can be fully absorbed before your reserves are exhausted.”
              </p>
            </div>
          )}

          {/* Exact Approval Flow */}
          {parseFloat(musdDepositInput) > 0 &&
            (reserves.musdAllowance ?? 0n) < parseEther(musdDepositInput || '0') && (
              <div className="p-4 border border-watch/40 bg-watch/10 rounded-sm space-y-3">
                <div className="flex items-center gap-2 text-watch text-xs font-mono font-semibold uppercase tracking-wider">
                  <Lock className="w-4 h-4 stroke-[1.5]" />
                  <span>MUSD Token Approval Required</span>
                </div>
                <p className="text-xs font-sans text-ink-muted">
                  Spender: <span className="font-mono text-ink">{vault.vaultAddress}</span> (Your
                  Personal Vault)
                </p>

                <div className="flex items-center gap-4 text-xs font-mono text-ink">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="approvalAmount"
                      checked={!approveBuffer}
                      onChange={() => setApproveBuffer(false)}
                    />
                    <span>Approve exact amount ({musdDepositInput} MUSD)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="approvalAmount"
                      checked={approveBuffer}
                      onChange={() => setApproveBuffer(true)}
                    />
                    <span>Approve larger buffer</span>
                  </label>
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleApproveMusd}
                  disabled={writeHook.isPending}
                  loading={writeHook.isPending}
                >
                  Approve MUSD Spender
                </Button>
              </div>
            )}

          <div className="pt-2 flex items-center gap-4">
            <Button
              variant="primary"
              onClick={handleDepositReserves}
              disabled={
                writeHook.isPending ||
                (parseFloat(musdDepositInput) > 0 &&
                  (reserves.musdAllowance ?? 0n) < parseEther(musdDepositInput || '0'))
              }
              loading={writeHook.isPending}
            >
              Deposit Reserves into Vault
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setStepOverridden(true);
                setActiveStep(5);
              }}
            >
              Proceed to Review →
            </Button>
            <Button
              variant="quiet"
              onClick={() => {
                setStepOverridden(true);
                setActiveStep(3);
              }}
            >
              ← Back
            </Button>
          </div>
        </div>
      )}

      {/* STEP 5: REVIEW & ARM */}
      {activeStep === 5 && (
        <div className="border border-hairline bg-paper-surface p-6 rounded-sm space-y-6">
          <div className="border-b border-hairline pb-3 flex items-center justify-between">
            <div>
              <span className="text-xs font-mono uppercase text-ember font-semibold tracking-wider">
                Step 5 of 5
              </span>
              <h2 className="text-xl font-serif font-bold text-ink mt-0.5">
                Review & Arm Protection
              </h2>
            </div>
            <StatusBadge status={rule.enabled ? 'Armed' : 'Disarmed'} />
          </div>

          {/* Ledger Summary */}
          <div className="border border-hairline rounded-sm divide-y divide-hairline bg-paper font-mono text-xs">
            <div className="p-3 flex justify-between items-center">
              <span className="text-ink-muted">Personal Vault Address</span>
              <a
                href={`https://explorer.test.mezo.org/address/${vault.vaultAddress}`}
                target="_blank"
                rel="noreferrer"
                className="text-ink font-semibold flex items-center gap-1 hover:text-ember"
              >
                <span>{vault.vaultAddress}</span>
                <ExternalLink className="w-3.5 h-3.5 stroke-[1.5]" />
              </a>
            </div>

            <div className="p-3 flex justify-between items-center">
              <span className="text-ink-muted">Trove Collateral Locked</span>
              <span className="text-ink font-semibold">
                {Number(formatEther(position.collateral ?? 0n)).toFixed(4)} BTC
              </span>
            </div>

            <div className="p-3 flex justify-between items-center">
              <span className="text-ink-muted">Trove Gross Debt</span>
              <span className="text-ink font-semibold">
                {Number(formatEther(position.debt ?? 0n)).toLocaleString(undefined, { maximumFractionDigits: 2 })}{' '}
                MUSD
              </span>
            </div>

            <div className="p-3 flex justify-between items-center">
              <span className="text-ink-muted">Live ICR</span>
              <span className="text-safe font-bold">
                {position.icrPercent ? `${position.icrPercent.toFixed(1)}%` : '—'}
              </span>
            </div>

            <div className="p-3 flex justify-between items-center">
              <span className="text-ink-muted">Liquidation Price</span>
              <span className="text-ink font-semibold">
                ${Number(formatEther(position.liquidationPrice ?? 0n)).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            </div>

            <div className="p-3 flex justify-between items-center">
              <span className="text-ink-muted">Safety Rule Trigger / Target</span>
              <span className="text-ink font-semibold">
                Trigger: {rule.triggerPercent?.toFixed(1) ?? '125.0'}% • Target:{' '}
                {rule.targetPercent?.toFixed(1) ?? '140.0'}%
              </span>
            </div>

            <div className="p-3 flex justify-between items-center">
              <span className="text-ink-muted">Funded MUSD Reserve</span>
              <span className="text-ink font-semibold">
                {Number(formatEther(reserves.musdReserve ?? 0n)).toFixed(2)} MUSD
              </span>
            </div>

            <div className="p-3 flex justify-between items-center">
              <span className="text-ink-muted">Funded BTC Reserve</span>
              <span className="text-ink font-semibold">
                {Number(formatEther(reserves.btcReserve ?? 0n)).toFixed(4)} BTC
              </span>
            </div>

            <div className="p-3 flex justify-between items-center">
              <span className="text-ink-muted">Absorption Capacity</span>
              <span className="text-safe font-bold">
                {reserves.defenseCapacity
                  ? `a further ${reserves.defenseCapacity.absorbableDropPercent.toFixed(1)}% BTC drop`
                  : '—'}
              </span>
            </div>
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-4">
            {!rule.enabled ? (
              <Button
                variant="primary"
                onClick={handleArmProtection}
                disabled={writeHook.isPending}
                loading={writeHook.isPending}
              >
                Arm Autonomous Defense
              </Button>
            ) : (
              <div className="flex items-center gap-2 text-safe text-sm font-mono font-semibold">
                <ShieldCheck className="w-5 h-5 stroke-[2]" />
                <span>Protection is Armed & Active</span>
              </div>
            )}

            <Link href="/app/overview">
              <Button variant="secondary">Go to Live Overview Dashboard →</Button>
            </Link>

            <Button
              variant="quiet"
              onClick={() => {
                setStepOverridden(true);
                setActiveStep(4);
              }}
            >
              ← Edit Reserves
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
