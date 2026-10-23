'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Header } from '../../components/layout/header';
import { Footer } from '../../components/layout/footer';
import { Button, IconButton } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Slider } from '../../components/ui/slider';
import { Switch } from '../../components/ui/switch';
import { Stat } from '../../components/ui/stat';
import { DataRow } from '../../components/ui/data-row';
import { StatusBadge } from '../../components/ui/status-badge';
import { Tabs } from '../../components/ui/tabs';
import { Dialog } from '../../components/ui/dialog';
import { Popover } from '../../components/ui/popover';
import { Tooltip, TooltipProvider } from '../../components/ui/tooltip';
import { Toast } from '../../components/ui/toast';
import { Stepper } from '../../components/ui/stepper';
import { Table } from '../../components/ui/table';
import { Skeleton } from '../../components/ui/skeleton';
import { EmptyState } from '../../components/ui/empty-state';
import { AddressChip } from '../../components/ui/address-chip';
import { MezoBadge } from '../../components/ui/mezo-badge';
import { TxStatus } from '../../components/ui/tx-status';
import { Banner } from '../../components/ui/banner';
import { HealthGauge } from '../../components/ui/health-gauge';
import { ArrowLeft, Bell, Settings, Info, Anchor } from 'lucide-react';

export function DesignCatalog() {
  const [inputValue, setInputValue] = useState('1.25');
  const [selectValue, setSelectValue] = useState('musd');
  const [sliderValue, setSliderValue] = useState([140]);
  const [switchChecked, setSwitchChecked] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [bannerVisible, setBannerVisible] = useState(true);

  const sampleTableData = [
    { rule: 'Safe Threshold', parameter: 'triggerICR', value: '135%', status: 'Armed' },
    { rule: 'Restoration', parameter: 'targetICR', value: '180%', status: 'Armed' },
    { rule: 'Keeper Bounty', parameter: 'maxTipBps', value: '50 bps (0.5%)', status: 'Active' },
  ];

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-paper text-ink flex flex-col font-sans">
        <Header />

        <main className="max-w-container mx-auto px-4 md:px-6 py-10 grow w-full">
          {/* Header Strip */}
          <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-hairline pb-6 mb-10">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-ink-muted mb-2">
                <Link href="/" className="hover:text-ink flex items-center gap-1">
                  <ArrowLeft className="w-3.5 h-3.5 stroke-[1.5]" />
                  <span>Return to Landing</span>
                </Link>
                <span>/</span>
                <span>Engineering Spec</span>
              </div>
              <h1 className="text-3xl font-serif font-bold text-ink">
                Design System & Component Catalog
              </h1>
              <p className="text-sm font-sans text-ink-muted mt-1 max-w-2xl">
                Instrument-grade, ledger-inspired UI primitives adhering to strict WCAG AA contrast,
                self-hosted fonts, and zero-mock policy.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-2 py-1 text-xs font-mono border border-hairline bg-paper-surface rounded-sm">
                Dev Environment
              </span>
            </div>
          </div>

          {/* Section 1: Color Tokens & WCAG AA Contrast Audit */}
          <section className="mb-14">
            <h2 className="text-xl font-serif font-semibold text-ink mb-2">
              1. Color Tokens & Contrast Matrix
            </h2>
            <p className="text-xs font-mono text-ink-muted mb-6">
              Every token pair is verified via relative luminance calculation to meet or exceed WCAG
              AA standards.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Light Theme Tokens */}
              <div className="border border-hairline bg-paper-raised p-5 rounded-sm">
                <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-ink mb-4 pb-2 border-b border-hairline">
                  Light Theme Tokens (Warm Paper)
                </h3>
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between p-2 rounded bg-[#F4F1EA] text-[#14130F] border border-hairline">
                    <span>Paper Base (#F4F1EA) + Ink (#14130F)</span>
                    <span className="font-semibold text-safe">16.48:1 (PASS)</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-[#F4F1EA] text-[#3A3830] border border-hairline">
                    <span>Paper Base + Ink Soft (#3A3830)</span>
                    <span className="font-semibold text-safe">10.41:1 (PASS)</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-[#F4F1EA] text-[#6B675C] border border-hairline">
                    <span>Paper Base + Muted (#6B675C)</span>
                    <span className="font-semibold text-safe">5.00:1 (PASS)</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-[#F4F1EA] text-[#2F6F5E] border border-hairline">
                    <span>Paper Base + Safe Verdigris (#2F6F5E)</span>
                    <span className="font-semibold text-safe">5.23:1 (PASS)</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-[#F4F1EA] text-[#A32020] border border-hairline">
                    <span>Paper Base + Danger Oxide Red (#A32020)</span>
                    <span className="font-semibold text-safe">6.69:1 (PASS)</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-[#F4F1EA] text-[#B8431F] border border-hairline">
                    <span>Paper Base + Accent Ember (#B8431F)</span>
                    <span className="font-semibold text-safe">4.82:1 (PASS)</span>
                  </div>
                </div>
              </div>

              {/* Dark Theme Tokens */}
              <div className="border border-hairline bg-[#0E0E0C] text-[#EDE9DF] p-5 rounded-sm">
                <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-[#EDE9DF] mb-4 pb-2 border-b border-[rgba(237,233,223,0.14)]">
                  Dark Theme Tokens (Deep Ink)
                </h3>
                <div className="space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between p-2 rounded bg-[#0E0E0C] text-[#EDE9DF] border border-[rgba(237,233,223,0.14)]">
                    <span>Ground (#0E0E0C) + Text (#EDE9DF)</span>
                    <span className="font-semibold text-[#449B85]">15.94:1 (PASS)</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-[#0E0E0C] text-[#8F8A7C] border border-[rgba(237,233,223,0.14)]">
                    <span>Ground + Muted (#8F8A7C)</span>
                    <span className="font-semibold text-[#449B85]">5.61:1 (PASS)</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-[#0E0E0C] text-[#449B85] border border-[rgba(237,233,223,0.14)]">
                    <span>Ground + Safe (#449B85)</span>
                    <span className="font-semibold text-[#449B85]">5.77:1 (PASS)</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-[#0E0E0C] text-[#D9983B] border border-[rgba(237,233,223,0.14)]">
                    <span>Ground + Watch (#D9983B)</span>
                    <span className="font-semibold text-[#449B85]">7.83:1 (PASS)</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-[#0E0E0C] text-[#E04A4A] border border-[rgba(237,233,223,0.14)]">
                    <span>Ground + Danger (#E04A4A)</span>
                    <span className="font-semibold text-[#449B85]">4.83:1 (PASS)</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-[#0E0E0C] text-[#D95C34] border border-[rgba(237,233,223,0.14)]">
                    <span>Ground + Ember (#D95C34)</span>
                    <span className="font-semibold text-[#449B85]">5.09:1 (PASS)</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: Signature Component — Health Gauge */}
          <section className="mb-14">
            <h2 className="text-xl font-serif font-semibold text-ink mb-2">
              2. Signature Component: Health Gauge
            </h2>
            <p className="text-xs font-mono text-ink-muted mb-6">
              A custom SVG instrument ruler spanning 100% to 300% ICR. Shows MCR liquidation zone
              (110%), caution band (150%), and keyboard-accessible markers.
            </p>

            <div className="space-y-6">
              <div>
                <h4 className="text-xs font-mono text-ink-muted uppercase mb-2">
                  State: Sound Position (ICR 185%, Trigger 135%, Target 180%)
                </h4>
                <HealthGauge current={185} trigger={135} target={180} />
              </div>

              <div>
                <h4 className="text-xs font-mono text-ink-muted uppercase mb-2">
                  State: Caution Band (ICR 132%, Approaching Trigger)
                </h4>
                <HealthGauge current={132} trigger={130} target={175} />
              </div>

              <div>
                <h4 className="text-xs font-mono text-ink-muted uppercase mb-2">
                  State: Near Liquidation (ICR 108%, Below MCR 110%)
                </h4>
                <HealthGauge current={108} trigger={125} target={160} />
              </div>

              <div>
                <h4 className="text-xs font-mono text-ink-muted uppercase mb-2">
                  State: Loading Skeleton State
                </h4>
                <HealthGauge loading={true} />
              </div>

              <div>
                <h4 className="text-xs font-mono text-ink-muted uppercase mb-2">
                  State: Empty / Uncalculated State (Rule 1 Compliant)
                </h4>
                <HealthGauge current={null} trigger={null} target={null} />
              </div>
            </div>
          </section>

          {/* Section 3: Buttons & Controls */}
          <section className="mb-14">
            <h2 className="text-xl font-serif font-semibold text-ink mb-2">
              3. Buttons, Icons & Micro-Controls
            </h2>
            <p className="text-xs font-mono text-ink-muted mb-6">
              Variants: primary ink, secondary hairline, quiet, danger. Sizes: sm, md, lg.
            </p>

            <div className="p-6 border border-hairline bg-paper-raised rounded-sm space-y-6">
              {/* Variants */}
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary">Primary Ink</Button>
                <Button variant="secondary">Secondary Hairline</Button>
                <Button variant="quiet">Quiet Button</Button>
                <Button variant="danger">Danger Action</Button>
                <Button variant="primary" loading>
                  Loading...
                </Button>
                <Button variant="primary" disabled>
                  Disabled
                </Button>
              </div>

              {/* Sizes */}
              <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-hairline">
                <Button size="sm" variant="secondary">
                  Small (30px)
                </Button>
                <Button size="md" variant="secondary">
                  Medium (38px)
                </Button>
                <Button size="lg" variant="secondary">
                  Large (46px)
                </Button>
                <IconButton
                  size="sm"
                  aria-label="Settings"
                  icon={<Settings className="w-3.5 h-3.5 stroke-[1.5]" />}
                />
                <IconButton
                  size="md"
                  aria-label="Notifications"
                  icon={<Bell className="w-4 h-4 stroke-[1.5]" />}
                />
                <IconButton
                  size="lg"
                  aria-label="Info"
                  icon={<Info className="w-4 h-4 stroke-[1.5]" />}
                />
              </div>
            </div>
          </section>

          {/* Section 4: Form Inputs, Sliders & Switches */}
          <section className="mb-14">
            <h2 className="text-xl font-serif font-semibold text-ink mb-2">
              4. Inputs, Unit Adornments, Select & Toggles
            </h2>
            <p className="text-xs font-mono text-ink-muted mb-6">
              Precision inputs featuring inline MAX action, unit tags, and inline validation errors.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 border border-hairline bg-paper-raised rounded-sm">
              <Input
                label="Collateral Deposit"
                unit="BTC"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                maxAction={() => setInputValue('5.00')}
                helperText="Available in wallet: 5.00 BTC"
              />

              <Input
                label="MUSD Debt Amount"
                unit="MUSD"
                defaultValue="1500"
                error="Must be at least 1,800 MUSD min net debt"
              />

              <Select
                label="Target Currency"
                value={selectValue}
                onValueChange={setSelectValue}
                options={[
                  { value: 'musd', label: 'MUSD Stablecoin' },
                  { value: 'btc', label: 'Native BTC' },
                  { value: 'usdc', label: 'Bridged USDC', disabled: true },
                ]}
              />

              <div className="md:col-span-2 pt-4 border-t border-hairline">
                <Slider
                  label="Automated Defense Trigger Threshold"
                  value={sliderValue}
                  onValueChange={setSliderValue}
                  min={115}
                  max={250}
                  unit="%"
                />
              </div>

              <div className="pt-4 border-t border-hairline flex items-center">
                <Switch
                  label="Autonomous Keeper Defense"
                  description="Enable permissionless bots to execute defense"
                  checked={switchChecked}
                  onCheckedChange={setSwitchChecked}
                />
              </div>
            </div>
          </section>

          {/* Section 5: Stats, Ledger DataRows & Badges */}
          <section className="mb-14">
            <h2 className="text-xl font-serif font-semibold text-ink mb-2">
              5. Ledger Stats & Dotted DataRows
            </h2>
            <p className="text-xs font-mono text-ink-muted mb-6">
              Private-bank ledger aesthetic with tabular numerals, dotted leaders, and status
              indicators.
            </p>

            <div className="space-y-6">
              {/* Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <Stat
                  label="Live ICR"
                  value="178.4%"
                  tooltip="Individual Collateral Ratio = (Collateral * Price) / Debt"
                  delta={{ value: '+4.2%', type: 'positive' }}
                />
                <Stat
                  label="Liquidation Price"
                  value="$58,410"
                  unit="USD"
                  tooltip="Bitcoin price at which ICR drops to 110% MCR"
                  delta={{ value: '-12.0%', type: 'negative' }}
                />
                <Stat
                  label="Defense Reserve"
                  value="3,200"
                  unit="MUSD"
                  tooltip="Pre-funded buffer available in your BallastVault"
                />
                <Stat
                  label="Unfunded Trove"
                  value={null}
                  tooltip="Honest empty state when no wallet or vault is connected"
                />
              </div>

              {/* Status & Verification Badges */}
              <div className="p-4 border border-hairline bg-paper-raised rounded-sm flex flex-wrap items-center gap-4">
                <span className="text-xs font-mono text-ink-muted uppercase mr-2">
                  Status Badges:
                </span>
                <StatusBadge status="Armed" />
                <StatusBadge status="Watch" />
                <StatusBadge status="Danger" />
                <StatusBadge status="Disarmed" />

                <span className="text-xs font-mono text-ink-muted uppercase ml-4 mr-2">
                  Official Mezo Badges:
                </span>
                <MezoBadge size="xs" variant="pill" />
                <MezoBadge size="sm" variant="pill" />
                <MezoBadge size="md" variant="pill" />
                <MezoBadge size="xs" variant="compact" />
              </div>

              {/* DataRows */}
              <div className="p-5 border border-hairline bg-paper-raised rounded-sm max-w-2xl">
                <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-ink mb-3 pb-2 border-b border-hairline">
                  Vault Balance Sheet
                </h4>
                <DataRow label="Locked Collateral" value="2.4500 BTC" subValue="$183,750 USD" />
                <DataRow
                  label="Outstanding Debt"
                  value="78,400.00 MUSD"
                  subValue="inc. 200 gas comp"
                />
                <DataRow
                  label="Individual Ratio"
                  value="234.3%"
                  badge={<StatusBadge status="Armed" />}
                />
                <DataRow label="Autonomous Keeper" value="0.50% tip" hint="capped at 100 bps" />
              </div>
            </div>
          </section>

          {/* Section 6: Dialogs, Popovers, Tabs & Toasts */}
          <section className="mb-14">
            <h2 className="text-xl font-serif font-semibold text-ink mb-2">
              6. Overlays, Tabs & Feedback
            </h2>
            <p className="text-xs font-mono text-ink-muted mb-6">
              Radix-powered dialogs, popovers, and tabs with zero glassmorphism and crisp hairline
              outlines.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 border border-hairline bg-paper-raised rounded-sm">
              <div className="space-y-4">
                <h4 className="text-xs font-mono text-ink-muted uppercase">Overlays & Modals</h4>
                <div className="flex flex-wrap gap-3">
                  <Button variant="secondary" onClick={() => setDialogOpen(true)}>
                    Open Dialog Preview
                  </Button>

                  <Popover
                    trigger={<Button variant="secondary">Open Popover</Button>}
                    content={
                      <div className="max-w-xs space-y-2">
                        <span className="font-semibold block text-ink">Keeper Mechanics</span>
                        <p className="text-ink-muted">
                          Anyone can call defend() when ICR drops below triggerICR. The caller
                          receives a tip from the repaid debt.
                        </p>
                      </div>
                    }
                  />

                  <Tooltip content="Tooltip explaining MUSD borrowing rate (0.5% base)">
                    <Button variant="quiet">Hover for Tooltip</Button>
                  </Tooltip>

                  <Button variant="secondary" onClick={() => setToastOpen(true)}>
                    Trigger Toast Notification
                  </Button>
                </div>

                <Dialog
                  open={dialogOpen}
                  onOpenChange={setDialogOpen}
                  title="Configure Automated Defense Rule"
                  description="Adjust trigger and target thresholds for your BallastVault proxy."
                >
                  <div className="space-y-4 py-2">
                    <Input
                      label="Trigger Threshold"
                      unit="%"
                      defaultValue="135"
                      helperText="Triggers defense below this ICR"
                    />
                    <Input
                      label="Target Restoration"
                      unit="%"
                      defaultValue="180"
                      helperText="Restores ICR back to this safe waterline"
                    />
                    <div className="flex justify-end gap-2 pt-4 border-t border-hairline">
                      <Button variant="quiet" onClick={() => setDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button variant="primary" onClick={() => setDialogOpen(false)}>
                        Save Rule
                      </Button>
                    </div>
                  </div>
                </Dialog>

                <Toast
                  open={toastOpen}
                  onOpenChange={setToastOpen}
                  title="Transaction Confirmed"
                  description="Pre-funded 1,000 MUSD into your BallastVault defense reserve."
                  type="success"
                />
              </div>

              {/* Tabs */}
              <div>
                <h4 className="text-xs font-mono text-ink-muted uppercase mb-4">Tabs Component</h4>
                <Tabs
                  items={[
                    {
                      value: 'parameters',
                      label: 'Parameters',
                      content: (
                        <div className="text-xs font-mono text-ink-muted space-y-2">
                          <p>MCR: 110% (Liquidation Threshold)</p>
                          <p>CCR: 150% (Critical Collateral Ratio)</p>
                          <p>Min Net Debt: 1,800 MUSD</p>
                        </div>
                      ),
                    },
                    {
                      value: 'contracts',
                      label: 'Contracts',
                      content: (
                        <div className="space-y-2">
                          <AddressChip
                            address="0xCdF7028ceAB81fA0C6971208e83fa7872994beE5"
                            label="BorrowerOps"
                          />
                          <AddressChip
                            address="0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0"
                            label="TroveManager"
                          />
                        </div>
                      ),
                    },
                  ]}
                />
              </div>
            </div>
          </section>

          {/* Section 7: Stepper, Table & Empty States */}
          <section className="mb-14">
            <h2 className="text-xl font-serif font-semibold text-ink mb-2">
              7. Ledger Tables, Stepper & Honest Empty States
            </h2>
            <p className="text-xs font-mono text-ink-muted mb-6">
              Clean tabular ledgers and zero-mock empty states fulfilling Rule 1.
            </p>

            <div className="space-y-8">
              {/* Stepper */}
              <div className="p-6 border border-hairline bg-paper-raised rounded-sm">
                <h4 className="text-xs font-mono text-ink-muted uppercase mb-4">
                  3-Step Vault Onboarding Stepper
                </h4>
                <Stepper
                  currentStep={2}
                  steps={[
                    {
                      title: 'Deploy Vault',
                      description: 'Deterministic EIP-1167 proxy via CREATE2',
                    },
                    {
                      title: 'Configure Rules',
                      description: 'Set trigger and target collateral thresholds',
                    },
                    { title: 'Fund Reserve', description: 'Deposit defense MUSD and native BTC' },
                  ]}
                />
              </div>

              {/* Skeleton Loading States */}
              <div className="p-6 border border-hairline bg-paper-raised rounded-sm space-y-3">
                <h4 className="text-xs font-mono text-ink-muted uppercase">
                  Shape-Matched Skeletons
                </h4>
                <div className="space-y-2 max-w-md">
                  <Skeleton variant="text" />
                  <Skeleton variant="rect" />
                  <div className="flex items-center gap-2 pt-2">
                    <Skeleton variant="circle" />
                    <Skeleton variant="text" className="w-32" />
                  </div>
                </div>
              </div>

              {/* Ledger Table */}
              <div className="space-y-3">
                <h4 className="text-xs font-mono text-ink-muted uppercase">
                  Active Defense Rules Table
                </h4>
                <Table
                  columns={[
                    { header: 'Rule Parameter', accessorKey: 'rule' },
                    { header: 'Solidity Variable', accessorKey: 'parameter' },
                    { header: 'Configured Value', accessorKey: 'value', align: 'right' },
                    {
                      header: 'Status',
                      align: 'right',
                      render: (row) => (
                        <StatusBadge status={row.status === 'Armed' ? 'Armed' : 'Watch'} />
                      ),
                    },
                  ]}
                  data={sampleTableData}
                />
              </div>

              {/* Empty State Preview */}
              <div>
                <h4 className="text-xs font-mono text-ink-muted uppercase mb-3">
                  Honest Zero-Mock Empty State
                </h4>
                <EmptyState
                  icon={<Anchor className="w-6 h-6 stroke-[1.5]" />}
                  title="No BallastVault Initialized"
                  description="Connect your wallet to inspect your trove status or deploy a personal defense vault."
                  action={<Button variant="primary">Connect Mezo Wallet</Button>}
                />
              </div>

              {/* Transaction Statuses */}
              <div className="p-4 border border-hairline bg-paper-raised rounded-sm space-y-3">
                <h4 className="text-xs font-mono text-ink-muted uppercase">
                  Transaction Status Indicators
                </h4>
                <div className="flex flex-wrap gap-4">
                  <TxStatus
                    status="pending"
                    hash="0x8f2d4e7a1b3c5e6f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f"
                  />
                  <TxStatus
                    status="confirmed"
                    hash="0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b"
                  />
                  <TxStatus
                    status="failed"
                    hash="0x9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e9d8c7b6a5f4e3d2c1b0a9f8e"
                  />
                </div>
              </div>

              {/* Banners */}
              {bannerVisible && (
                <div className="space-y-3">
                  <h4 className="text-xs font-mono text-ink-muted uppercase">Editorial Banners</h4>
                  <Banner
                    variant="info"
                    title="Immutable Verification"
                    onDismiss={() => setBannerVisible(false)}
                  >
                    All BallastVault proxies link to immutable Mezo MUSD contracts. There is no
                    admin key capable of halting liquidation protection.
                  </Banner>
                  <Banner variant="warning" title="Minimum Net Debt Boundary">
                    Trove debt cannot be reduced into the (0, 1,800 MUSD) range. Repayments are
                    clamped to maintain $\ge 1,800$ MUSD net debt.
                  </Banner>
                </div>
              )}
            </div>
          </section>
        </main>

        <Footer />
      </div>
    </TooltipProvider>
  );
}
