'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { formatEther } from 'viem';
import { useQuery } from 'convex/react';
import { api } from '../../../lib/convex-api';
import { useVault, useActivity, type ActivityItem } from '../../../hooks';
import { BRAND_URLS, PRECISION } from '@ballast/shared';
import { Button } from '../../../components/ui/button';
import { Table } from '../../../components/ui/table';
import { EmptyState } from '../../../components/ui/empty-state';
import { Skeleton } from '../../../components/ui/skeleton';
import { StatusBadge } from '../../../components/ui/status-badge';
import { AddressChip } from '../../../components/ui/address-chip';
import {
  History,
  Download,
  ExternalLink,
  Filter,
  ChevronLeft,
  ChevronRight,
  Info,
  Lock,
} from 'lucide-react';

export type EventFilter = 'all' | 'defended' | 'reserves' | 'rules' | 'trove';

const ITEMS_PER_PAGE = 10;

export default function ActivityPage() {
  const { address: userAddress, isConnected } = useAccount();
  const { vaultAddress, exists: vaultExists, isLoading: vaultLoading } = useVault(userAddress);
  const { activities, isLoading: activityLoading } = useActivity(vaultAddress);

  // Optional Convex keeper audit context
  const convexDefenses = useQuery(
    api.keeper.getDefensesByVault,
    vaultAddress ? { vault: vaultAddress } : 'skip'
  );

  // Filter state
  const [filter, setFilter] = useState<EventFilter>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Map Convex keeper data by txHash
  const convexKeeperMap = useMemo(() => {
    const map = new Map<string, { keeper: string; status: string; effectiveGasPrice?: string }>();
    if (convexDefenses) {
      for (const d of convexDefenses) {
        map.set(d.txHash.toLowerCase(), {
          keeper: d.keeper,
          status: d.status,
          effectiveGasPrice: d.effectiveGasPrice,
        });
      }
    }
    return map;
  }, [convexDefenses]);

  // Filtered on-chain activities
  const filteredActivities = useMemo(() => {
    return activities.filter((act) => {
      if (filter === 'all') return true;
      if (filter === 'defended') return act.eventName === 'Defended';
      if (filter === 'reserves') {
        return act.eventName === 'ReserveDeposited' || act.eventName === 'ReserveWithdrawn';
      }
      if (filter === 'rules') return act.eventName === 'RuleSet';
      if (filter === 'trove') {
        return (
          act.eventName === 'TroveOpened' ||
          act.eventName === 'TroveAdjusted' ||
          act.eventName === 'TroveClosed' ||
          act.eventName === 'CollateralClaimed'
        );
      }
      return true;
    });
  }, [activities, filter]);

  // Paginated activities
  const totalPages = Math.max(1, Math.ceil(filteredActivities.length / ITEMS_PER_PAGE));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredActivities.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredActivities, currentPage]);

  // Format Event Details
  const formatEventDetails = (act: ActivityItem) => {
    const { eventName, args } = act;

    if (eventName === 'Defended') {
      const repaid = args?.musdRepaid ? Number(formatEther(args.musdRepaid)).toFixed(2) : '0';
      const added = args?.btcAdded ? Number(formatEther(args.btcAdded)).toFixed(4) : '0';
      const oldIcr = args?.icrBefore ? (Number((args.icrBefore * 10000n) / PRECISION) / 100).toFixed(1) : '—';
      const newIcr = args?.icrAfter ? (Number((args.icrAfter * 10000n) / PRECISION) / 100).toFixed(1) : '—';
      const keeper = convexKeeperMap.get(act.txHash.toLowerCase())?.keeper || args?.keeper;

      return (
        <div className="space-y-1 font-mono text-xs">
          <div className="flex items-center gap-1.5 text-ember font-semibold">
            <span>Repaid {repaid} MUSD</span>
            {parseFloat(added) > 0 && <span>+ Added {added} BTC</span>}
          </div>
          <div className="text-[11px] text-ink-muted">
            ICR: {oldIcr}% → <span className="text-safe font-bold">{newIcr}%</span>
            {keeper && <span> • Keeper: {keeper.slice(0, 6)}...{keeper.slice(-4)}</span>}
          </div>
        </div>
      );
    }

    if (eventName === 'ReserveDeposited') {
      const isBtc = !args?.token || args.token === '0x0000000000000000000000000000000000000000';
      const amount = args?.amount ? Number(formatEther(args.amount)).toFixed(isBtc ? 4 : 2) : '0';
      const total = args?.newReserve ? Number(formatEther(args.newReserve)).toFixed(isBtc ? 4 : 2) : '0';
      return (
        <div className="font-mono text-xs space-y-0.5">
          <span className="text-safe font-semibold">
            +{amount} {isBtc ? 'BTC' : 'MUSD'}
          </span>
          <div className="text-[11px] text-ink-muted">Total Reserve: {total} {isBtc ? 'BTC' : 'MUSD'}</div>
        </div>
      );
    }

    if (eventName === 'ReserveWithdrawn') {
      const isBtc = !args?.token || args.token === '0x0000000000000000000000000000000000000000';
      const amount = args?.amount ? Number(formatEther(args.amount)).toFixed(isBtc ? 4 : 2) : '0';
      const total = args?.newReserve ? Number(formatEther(args.newReserve)).toFixed(isBtc ? 4 : 2) : '0';
      return (
        <div className="font-mono text-xs space-y-0.5">
          <span className="text-danger font-semibold">
            -{amount} {isBtc ? 'BTC' : 'MUSD'}
          </span>
          <div className="text-[11px] text-ink-muted">Remaining Reserve: {total} {isBtc ? 'BTC' : 'MUSD'}</div>
        </div>
      );
    }

    if (eventName === 'RuleSet') {
      const trig = args?.triggerICR ? (Number((args.triggerICR * 10000n) / PRECISION) / 100).toFixed(0) : '—';
      const target = args?.targetICR ? (Number((args.targetICR * 10000n) / PRECISION) / 100).toFixed(0) : '—';
      const tip = args?.maxTipBps ? (args.maxTipBps / 100).toFixed(2) : '0';
      return (
        <div className="font-mono text-xs space-y-0.5">
          <span className="text-ink font-semibold">
            Trigger {trig}% → Target {target}%
          </span>
          <div className="text-[11px] text-ink-muted">
            Tip Cap: {tip}% • {args?.enabled ? 'Protection Active' : 'Protection Paused'}
          </div>
        </div>
      );
    }

    if (eventName === 'TroveOpened') {
      const debt = args?.debtAmount ? Number(formatEther(args.debtAmount)).toFixed(2) : '0';
      const coll = args?.collAmount ? Number(formatEther(args.collAmount)).toFixed(4) : '0';
      return (
        <div className="font-mono text-xs space-y-0.5">
          <span className="text-ink font-semibold">Opened with {coll} BTC</span>
          <div className="text-[11px] text-ink-muted">Minted {debt} MUSD Debt</div>
        </div>
      );
    }

    if (eventName === 'TroveAdjusted') {
      const coll = args?.collChange ? Number(formatEther(args.collChange)).toFixed(4) : '0';
      const debt = args?.debtChange ? Number(formatEther(args.debtChange)).toFixed(2) : '0';
      const isIncrease = args?.isDebtIncrease ?? false;
      return (
        <div className="font-mono text-xs space-y-0.5">
          <span className="text-ink font-semibold">
            {parseFloat(coll) > 0 && `Collateral: ${coll} BTC • `}
            Debt: {isIncrease ? '+' : '-'}{debt} MUSD
          </span>
        </div>
      );
    }

    if (eventName === 'TroveClosed') {
      return (
        <div className="font-mono text-xs text-danger font-semibold">
          Trove closed. Collateral returned to owner.
        </div>
      );
    }

    return <span className="font-mono text-xs text-ink-muted">{act.summary}</span>;
  };

  // CSV Export Functionality
  const handleExportCSV = () => {
    if (filteredActivities.length === 0) return;

    const headers = ['Event Name', 'Block Number', 'Timestamp', 'Tx Hash', 'Summary'];
    const rows = filteredActivities.map((act) => [
      act.eventName,
      act.blockNumber.toString(),
      act.timestamp ? new Date(act.timestamp * 1000).toISOString() : '',
      act.txHash,
      `"${act.summary.replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ballast-activity-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 1. Disconnected
  if (!isConnected) {
    return (
      <div className="space-y-8">
        <div className="border-b border-hairline pb-4">
          <span className="text-xs font-mono uppercase tracking-wider text-ink-muted">
            On-Chain Ledger
          </span>
          <h1 className="text-2xl font-serif font-bold text-ink">
            Historical Activity &amp; Keeper Audits
          </h1>
        </div>
        <EmptyState
          icon={<History className="w-6 h-6 stroke-[1.5]" />}
          title="Connect Wallet to Inspect Activity"
          description="View complete paginated history of on-chain defenses, reserve deposits, rules updates, and borrower operations."
        />
      </div>
    );
  }

  // 2. Loading
  if (vaultLoading || activityLoading) {
    return (
      <div className="space-y-8">
        <div className="border-b border-hairline pb-4">
          <Skeleton className="h-4 w-32 mb-2" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  // 3. No Vault
  if (!vaultExists || !vaultAddress) {
    return (
      <div className="space-y-8">
        <div className="border-b border-hairline pb-4">
          <span className="text-xs font-mono uppercase tracking-wider text-ink-muted">
            On-Chain Ledger
          </span>
          <h1 className="text-2xl font-serif font-bold text-ink">
            Historical Activity &amp; Keeper Audits
          </h1>
        </div>
        <EmptyState
          icon={<Lock className="w-6 h-6 stroke-[1.5]" />}
          title="No BallastVault Proxy Deployed"
          description="Deploy your BallastVault proxy to begin tracking on-chain defense logs and vault activities."
          action={
            <Link href="/app">
              <Button variant="primary">Launch Setup Wizard</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-hairline pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-ink-muted">
            On-Chain Ledger
          </span>
          <h1 className="text-2xl font-serif font-bold text-ink">
            Historical Activity &amp; Keeper Audits
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-ink-muted">Vault:</span>
          <AddressChip address={vaultAddress} showCopy showExplorer size="sm" />
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportCSV}
            disabled={filteredActivities.length === 0}
            className="flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </Button>
        </div>
      </div>

      {/* Filter Tabs Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-paper-raised p-4 border border-hairline rounded-sm">
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
          <span className="text-ink-muted mr-2 flex items-center gap-1 uppercase tracking-wider text-[11px]">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter:</span>
          </span>
          {[
            { id: 'all', label: `All Events (${activities.length})` },
            {
              id: 'defended',
              label: `Defenses (${activities.filter((a) => a.eventName === 'Defended').length})`,
            },
            {
              id: 'reserves',
              label: `Reserves (${activities.filter((a) => a.eventName.startsWith('Reserve')).length})`,
            },
            {
              id: 'rules',
              label: `Rules (${activities.filter((a) => a.eventName === 'RuleSet').length})`,
            },
            {
              id: 'trove',
              label: `Trove Actions (${activities.filter((a) => a.eventName.startsWith('Trove')).length})`,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setFilter(tab.id as EventFilter);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-sm border transition-colors ${
                filter === tab.id
                  ? 'border-ember bg-paper-surface font-bold text-ink'
                  : 'border-transparent text-ink-muted hover:text-ink'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="text-xs font-mono text-ink-muted tabular-nums">
          Showing {filteredActivities.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1}–
          {Math.min(currentPage * ITEMS_PER_PAGE, filteredActivities.length)} of {filteredActivities.length}
        </div>
      </div>

      {/* Event Ledger Table */}
      <div className="border border-hairline bg-paper-raised rounded-sm overflow-hidden">
        {filteredActivities.length === 0 ? (
          <div className="p-12 text-center text-xs font-mono text-ink-muted space-y-2">
            <History className="w-8 h-8 stroke-[1.5] mx-auto text-hairline-strong" />
            <p className="font-semibold text-ink">No events recorded for this filter</p>
            <p className="text-[11px]">On-chain events appear here automatically as transactions confirm.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table
              columns={[
                { key: 'type', header: 'Event Type' },
                { key: 'details', header: 'Action Details' },
                { key: 'block', header: 'Block #' },
                { key: 'time', header: 'Time' },
                { key: 'tx', header: 'Transaction' },
              ]}
              data={paginatedItems.map((act) => ({
                id: act.id,
                type: (
                  <div className="flex items-center gap-2">
                    <StatusBadge
                      status={
                        act.eventName === 'Defended'
                          ? 'active'
                          : act.eventName === 'ReserveDeposited'
                          ? 'active'
                          : act.eventName === 'ReserveWithdrawn'
                          ? 'warning'
                          : 'default'
                      }
                      label={act.eventName}
                    />
                  </div>
                ),
                details: formatEventDetails(act),
                block: (
                  <span className="font-mono text-xs text-ink tabular-nums">
                    #{act.blockNumber.toString()}
                  </span>
                ),
                time: (
                  <span className="font-mono text-[11px] text-ink-muted tabular-nums">
                    {act.timestamp
                      ? new Date(act.timestamp * 1000).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          month: 'short',
                          day: 'numeric',
                        })
                      : '—'}
                  </span>
                ),
                tx: (
                  <a
                    href={`${BRAND_URLS.mezoExplorer}/tx/${act.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-mono text-xs text-ember hover:underline"
                  >
                    <span>{act.txHash.slice(0, 6)}...{act.txHash.slice(-4)}</span>
                    <ExternalLink className="w-3 h-3 stroke-[1.5]" />
                  </a>
                ),
              }))}
            />
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-hairline bg-paper-surface text-xs font-mono">
            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </Button>

            <span className="text-ink-muted tabular-nums">
              Page {currentPage} of {totalPages}
            </span>

            <Button
              variant="secondary"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="flex items-center gap-1"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Ground Truth Citation */}
      <div className="p-4 bg-paper-surface border border-hairline rounded-sm flex items-start gap-3 text-xs font-mono text-ink-muted leading-relaxed">
        <Info className="w-4 h-4 text-ember shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-ink uppercase">Ground Truth Guarantee:</span>
          <p className="mt-0.5">
            Every entry listed in this ledger originates directly from on-chain event logs emitted by your BallastVault proxy on Mezo Matsnet. Convex indexers may supply supplemental keeper audit metadata, but never replace or fabricate raw chain reads.
          </p>
        </div>
      </div>
    </div>
  );
}
