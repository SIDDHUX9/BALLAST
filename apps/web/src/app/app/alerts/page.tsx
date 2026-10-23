'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from '../../../lib/convex-api';
import { useVault, useRule } from '../../../hooks';
import { useNotifications } from '../../../components/notifications/notifications-provider';
import { formatLinkMessage, formatUnlinkMessage } from '../../../lib/telegram-auth';
import { Button } from '../../../components/ui/button';
import { Slider } from '../../../components/ui/slider';
import { EmptyState } from '../../../components/ui/empty-state';
import { Skeleton } from '../../../components/ui/skeleton';
import { StatusBadge } from '../../../components/ui/status-badge';
import { AddressChip } from '../../../components/ui/address-chip';
import {
  Bell,
  Send,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  VolumeX,
  Volume2,
  Trash2,
  RefreshCw,
  Info,
} from 'lucide-react';

export type AlertFlowState =
  | 'not_linked'
  | 'awaiting_start'
  | 'awaiting_signature'
  | 'linked'
  | 'error';

export default function AlertsPage() {
  const { address: userAddress, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { notify } = useNotifications();

  const { vaultAddress } = useVault(userAddress);
  const rule = useRule(vaultAddress);

  // Convex Queries and Mutations
  const bindingData = useQuery(
    api.telegram.getUserBinding,
    userAddress ? { address: userAddress } : 'skip'
  );

  const createLinkToken = useMutation(api.telegram.createLinkToken);
  const updateWatchPercentMutation = useMutation(api.telegram.updateWatchPercent);
  const setMuteMutation = useMutation(api.telegram.setMute);
  const verifyAndLinkAction = useAction(api.telegram.verifyAndLink);
  const verifyAndUnlinkAction = useAction(api.telegram.verifyAndUnlink);

  // Flow State
  const [activeToken, setActiveToken] = useState<string | null>(null);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState<number | null>(null);
  const [flowError, setFlowError] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState<boolean>(false);

  // Watch-level slider state
  const [watchPercent, setWatchPercent] = useState<number>(135);
  const [isUpdatingWatch, setIsUpdatingWatch] = useState<boolean>(false);

  // Link token status query (polls automatically while token is active)
  const tokenStatus = useQuery(
    api.telegram.getLinkTokenStatus,
    activeToken ? { token: activeToken } : 'skip'
  );

  // Sync watchPercent with server data once linked
  useEffect(() => {
    if (bindingData?.watchPercent) {
      setWatchPercent(bindingData.watchPercent);
    } else if (rule.triggerPercent) {
      setWatchPercent(Math.round(rule.triggerPercent + 10));
    }
  }, [bindingData?.watchPercent, rule.triggerPercent]);

  // Determine current UI flow state
  const currentFlowState: AlertFlowState = useMemo(() => {
    if (flowError) return 'error';
    if (bindingData?.linked) return 'linked';
    if (isSigning) return 'awaiting_signature';
    if (tokenStatus?.status === 'chat_bound') return 'awaiting_signature';
    if (activeToken) return 'awaiting_start';
    return 'not_linked';
  }, [flowError, bindingData?.linked, isSigning, tokenStatus?.status, activeToken]);

  // Step 1: Request Link Token
  const handleStartLink = async () => {
    setFlowError(null);
    try {
      const res = await createLinkToken({});
      setActiveToken(res.token);
      setDeepLink(res.deepLink);
      setTokenExpiresAt(res.expiresAt);
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Failed to generate Telegram link token';
      setFlowError(msg);
    }
  };

  // Step 2: Sign Message & Verify
  const handleSignAndVerify = async () => {
    if (!userAddress || !activeToken || !tokenExpiresAt) return;
    setFlowError(null);
    setIsSigning(true);

    try {
      const nonce = Array.from({ length: 16 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join('');

      const msg = formatLinkMessage({
        token: activeToken,
        address: userAddress,
        nonce,
        expiresAt: tokenExpiresAt,
      });

      const signature = await signMessageAsync({ message: msg });

      await verifyAndLinkAction({
        token: activeToken,
        address: userAddress,
        nonce,
        expiry: tokenExpiresAt,
        signature,
        watchPercent,
      });

      notify({
        type: 'success',
        title: 'Telegram Linked',
        description: 'Your Telegram chat is now permanently linked to receive real-time alerts.',
      });

      setActiveToken(null);
      setDeepLink(null);
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Signature verification failed';
      setFlowError(msg);
    } finally {
      setIsSigning(false);
    }
  };

  // Unlink Flow: Sign & Unlink
  const handleUnlink = async () => {
    if (!userAddress) return;
    setFlowError(null);

    try {
      const nonce = Array.from({ length: 16 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join('');
      const expiresAt = Date.now() + 5 * 60 * 1000;

      const msg = formatUnlinkMessage({
        address: userAddress,
        nonce,
        expiresAt,
      });

      const signature = await signMessageAsync({ message: msg });

      await verifyAndUnlinkAction({
        address: userAddress,
        nonce,
        expiry: expiresAt,
        signature,
      });

      notify({
        type: 'info',
        title: 'Telegram Unlinked',
        description: 'Telegram notifications have been disabled for this wallet address.',
      });
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Failed to unlink Telegram';
      setFlowError(msg);
    }
  };

  // Update Watch-Level Setting
  const handleSaveWatchPercent = async () => {
    if (!userAddress) return;
    setIsUpdatingWatch(true);
    try {
      await updateWatchPercentMutation({
        address: userAddress,
        watchPercent,
      });
      notify({
        type: 'success',
        title: 'Alert Threshold Saved',
        description: `Early warning notifications will trigger when ICR falls below ${watchPercent}%.`,
      });
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Failed to update alert threshold';
      setFlowError(msg);
    } finally {
      setIsUpdatingWatch(false);
    }
  };

  // Mute / Unmute
  const handleSetMute = async (hours: number) => {
    if (!userAddress) return;
    try {
      const res = await setMuteMutation({
        address: userAddress,
        hours,
      });
      notify({
        type: res.isMuted ? 'warning' : 'info',
        title: res.isMuted ? `Alerts Muted (${hours}h)` : 'Alerts Unmuted',
        description: res.isMuted
          ? `Notifications muted until ${new Date(res.mutedUntil).toLocaleTimeString()}.`
          : 'Real-time alert delivery resumed.',
      });
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Failed to update mute status';
      setFlowError(msg);
    }
  };

  // 1. Disconnected
  if (!isConnected) {
    return (
      <div className="space-y-8">
        <div className="border-b border-hairline pb-4">
          <span className="text-xs font-mono uppercase tracking-wider text-ink-muted">
            Notifications & Keeper Triggers
          </span>
          <h1 className="text-2xl font-serif font-bold text-ink">
            Threshold Alerts & Telegram Dispatch
          </h1>
        </div>
        <EmptyState
          icon={<Bell className="w-6 h-6 stroke-[1.5]" />}
          title="Connect Wallet to Configure Alerts"
          description="Link your Telegram to receive instant alerts when your trove approaches liquidation or when keepers execute automated defenses."
        />
      </div>
    );
  }

  // 2. Loading
  if (bindingData === undefined) {
    return (
      <div className="space-y-8">
        <div className="border-b border-hairline pb-4">
          <Skeleton className="h-4 w-32 mb-2" />
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-hairline pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-ink-muted">
            Notifications &amp; Keeper Triggers
          </span>
          <h1 className="text-2xl font-serif font-bold text-ink">
            Threshold Alerts &amp; Telegram Dispatch
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-ink-muted">Wallet:</span>
          {userAddress && <AddressChip address={userAddress} showCopy showExplorer size="sm" />}
          <StatusBadge
            status={bindingData?.linked ? 'active' : 'inactive'}
            label={bindingData?.linked ? 'Telegram Linked' : 'Not Linked'}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Link Flow Interactive Controller */}
        <div className="lg:col-span-7 space-y-6">
          <div className="border border-hairline bg-paper-raised p-6 rounded-sm space-y-6">
            <div className="border-b border-hairline pb-3">
              <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-ink">
                Telegram Connection Status
              </h3>
              <p className="text-[11px] font-mono text-ink-muted">
                Non-custodial EIP-191 / ERC-1271 wallet signature binding (Convex Backend)
              </p>
            </div>

            {/* Error Banner */}
            {flowError && (
              <div className="p-4 bg-danger/10 border border-danger/30 rounded-sm flex items-start justify-between gap-3 text-xs font-mono text-danger">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{flowError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFlowError(null);
                    setActiveToken(null);
                  }}
                  className="text-ink-muted hover:text-danger text-[10px] uppercase font-bold"
                >
                  Reset
                </button>
              </div>
            )}

            {/* STATE 1: NOT LINKED */}
            {currentFlowState === 'not_linked' && (
              <div className="space-y-4">
                <p className="text-xs font-mono text-ink-muted leading-relaxed">
                  Receive autonomous notifications on Telegram directly from the Ballast Keeper network. No passwords or custodial credentials required—verification uses a single-use cryptographic signature.
                </p>

                <div className="p-4 bg-paper-surface border border-hairline rounded-sm space-y-2 text-xs font-mono text-ink-muted">
                  <span className="font-bold text-ink uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-safe stroke-[1.5]" />
                    <span>Privacy &amp; Security Protocol:</span>
                  </span>
                  <ul className="list-disc list-inside space-y-1 text-[11px]">
                    <li>Only your Telegram Chat ID and public wallet address are persisted.</li>
                    <li>Zero personal data, emails, or phone numbers are ever stored.</li>
                    <li>Signatures use expiring single-use nonces to defeat replay attacks.</li>
                  </ul>
                </div>

                <Button variant="primary" size="lg" className="w-full" onClick={handleStartLink}>
                  <Send className="w-4 h-4 mr-2" />
                  <span>Start Telegram Linking Flow</span>
                </Button>
              </div>
            )}

            {/* STATE 2: AWAITING START IN TELEGRAM */}
            {currentFlowState === 'awaiting_start' && (
              <div className="space-y-5">
                <div className="p-4 bg-paper-surface border border-hairline rounded-sm space-y-3">
                  <div className="flex items-center gap-2 text-xs font-mono text-ember font-bold uppercase tracking-wider">
                    <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                    <span>Step 1 of 2: Open Bot in Telegram</span>
                  </div>
                  <p className="text-xs font-mono text-ink leading-relaxed">
                    Click the button below to open the official Ballast Alert Bot. Press <strong>Start</strong> in Telegram to register your chat ID.
                  </p>

                  {deepLink && (
                    <div className="pt-2">
                      <a href={deepLink} target="_blank" rel="noopener noreferrer">
                        <Button variant="primary" size="md" className="w-full">
                          <span>Open @BALLASTBTC_bot in Telegram</span>
                          <ExternalLink className="w-3.5 h-3.5 ml-2" />
                        </Button>
                      </a>
                    </div>
                  )}

                  <div className="text-[10px] font-mono text-ink-muted pt-2 border-t border-hairline flex items-center justify-between">
                    <span>Token: {activeToken?.slice(0, 10)}...</span>
                    <span>Awaiting incoming bot webhook...</span>
                  </div>
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={() => setActiveToken(null)}
                >
                  Cancel Linking
                </Button>
              </div>
            )}

            {/* STATE 3: AWAITING WALLET SIGNATURE */}
            {currentFlowState === 'awaiting_signature' && (
              <div className="space-y-5">
                <div className="p-4 bg-safe/10 border border-safe/30 rounded-sm space-y-3 text-xs font-mono">
                  <div className="flex items-center gap-2 text-safe font-bold uppercase tracking-wider">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Step 2 of 2: Authorize with Wallet Signature</span>
                  </div>
                  <p className="text-ink leading-relaxed">
                    Telegram chat confirmed! Sign the verification message containing your link token and address to permanently link your alerts.
                  </p>
                </div>

                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  disabled={isSigning}
                  onClick={handleSignAndVerify}
                >
                  {isSigning ? 'Requesting Wallet Signature...' : 'Sign to Link Telegram'}
                </Button>
              </div>
            )}

            {/* STATE 4: LINKED & ACTIVE */}
            {currentFlowState === 'linked' && (
              <div className="space-y-6">
                <div className="p-4 bg-safe/10 border border-safe/30 rounded-sm flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2 text-safe font-bold">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Active Telegram Alerts Connected</span>
                  </div>
                  <span className="text-ink-muted">
                    Chat ID: {bindingData.chatId ? `${bindingData.chatId.slice(0, 4)}...${bindingData.chatId.slice(-3)}` : 'Active'}
                  </span>
                </div>

                {/* Watch-Level Setting */}
                <div className="p-4 border border-hairline bg-paper-surface rounded-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-mono font-bold uppercase text-ink">
                        Early Warning Watch Threshold
                      </span>
                      <p className="text-[11px] font-mono text-ink-muted">
                        Receive a Telegram notification when ICR drops below this ratio
                      </p>
                    </div>
                    <span className="text-base font-serif font-bold text-ink tabular-nums px-2 py-0.5 rounded bg-paper-raised border border-hairline">
                      {watchPercent}%
                    </span>
                  </div>

                  <Slider
                    value={watchPercent}
                    min={115}
                    max={200}
                    step={1}
                    onValueChange={setWatchPercent}
                  />

                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    disabled={isUpdatingWatch || watchPercent === bindingData.watchPercent}
                    onClick={handleSaveWatchPercent}
                  >
                    {isUpdatingWatch ? 'Saving...' : 'Update Watch-Level'}
                  </Button>
                </div>

                {/* Mute Controls */}
                <div className="p-4 border border-hairline bg-paper-surface rounded-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-ink uppercase">
                      {bindingData.isMuted ? (
                        <VolumeX className="w-4 h-4 text-watch" />
                      ) : (
                        <Volume2 className="w-4 h-4 text-safe" />
                      )}
                      <span>Alert Dispatch State</span>
                    </div>
                    <span className={`text-[11px] font-mono ${bindingData.isMuted ? 'text-watch font-bold' : 'text-safe'}`}>
                      {bindingData.isMuted
                        ? `Muted until ${new Date(bindingData.mutedUntil).toLocaleTimeString()}`
                        : 'Active (Delivering Alerts)'}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 pt-1">
                    <Button
                      variant={bindingData.isMuted ? 'secondary' : 'primary'}
                      size="sm"
                      onClick={() => handleSetMute(0)}
                    >
                      Unmute
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => handleSetMute(1)}>
                      1 Hour
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => handleSetMute(8)}>
                      8 Hours
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => handleSetMute(24)}>
                      24 Hours
                    </Button>
                  </div>
                </div>

                {/* Unlink Action */}
                <div className="pt-2 border-t border-hairline">
                  <Button
                    variant="danger"
                    size="md"
                    className="w-full flex items-center justify-center gap-2"
                    onClick={handleUnlink}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Unlink Telegram Account</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Trigger Events & Alert Types Overview */}
        <div className="lg:col-span-5 space-y-6">
          <div className="border border-hairline bg-paper-raised p-6 rounded-sm space-y-4">
            <h3 className="text-xs font-mono uppercase tracking-wider font-bold text-ink border-b border-hairline pb-2">
              Dispatched Notification Events
            </h3>

            <div className="space-y-3 text-xs font-mono">
              <div className="p-3 bg-paper-surface border border-hairline rounded-sm space-y-1">
                <div className="flex items-center justify-between text-ink font-semibold">
                  <span>1. Early Warning Watch Band</span>
                  <span className="text-watch uppercase text-[10px]">Warning</span>
                </div>
                <p className="text-[11px] text-ink-muted leading-relaxed">
                  Dispatched whenever your trove ICR falls below your configured watch threshold (currently {watchPercent}%).
                </p>
              </div>

              <div className="p-3 bg-paper-surface border border-hairline rounded-sm space-y-1">
                <div className="flex items-center justify-between text-ink font-semibold">
                  <span>2. Autonomous Defense Executed</span>
                  <span className="text-ember uppercase text-[10px]">Defense</span>
                </div>
                <p className="text-[11px] text-ink-muted leading-relaxed">
                  Immediate notification with tx hash, debt repaid, BTC added, and new post-defense ICR whenever a keeper defends your vault.
                </p>
              </div>

              <div className="p-3 bg-paper-surface border border-hairline rounded-sm space-y-1">
                <div className="flex items-center justify-between text-ink font-semibold">
                  <span>3. Defense Reserves Depleted</span>
                  <span className="text-danger uppercase text-[10px]">Critical</span>
                </div>
                <p className="text-[11px] text-ink-muted leading-relaxed">
                  High-priority alert if defense reserves fall below the minimum needed to absorb further price declines.
                </p>
              </div>
            </div>
          </div>

          {/* Privacy & Zero-Knowledge Guarantee */}
          <div className="p-4 bg-paper-surface border border-hairline rounded-sm space-y-2 text-xs font-mono text-ink-muted leading-relaxed">
            <div className="flex items-center gap-1.5 text-ink font-bold uppercase tracking-wider">
              <Info className="w-3.5 h-3.5 text-ember stroke-[1.5]" />
              <span>Convex Automation Architecture</span>
            </div>
            <p>
              Alert evaluation runs on Convex scheduled crons in serverless functions. Zero custodial database passwords, zero plain-text API credentials, and 100% auditable via the public Mezo Matsnet explorer.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
