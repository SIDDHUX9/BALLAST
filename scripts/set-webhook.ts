#!/usr/bin/env tsx
/**
 * Script to register Convex HTTP endpoint as Telegram Webhook.
 *
 * Usage:
 *   npx tsx scripts/set-webhook.ts --url https://<deployment>.convex.site [--token <BOT_TOKEN>] [--secret <WEBHOOK_SECRET>]
 */

import { parseArgs } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      url: { type: 'string' },
      token: { type: 'string' },
      secret: { type: 'string' },
      drop: { type: 'boolean', default: false },
    },
    strict: false,
  });

  // 1. Resolve Bot Token
  let token = values.token || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const match = fs.readFileSync(envPath, 'utf-8').match(/TELEGRAM_BOT_TOKEN\s*=\s*(.+)/);
      if (match) token = match[1].trim();
    }
  }

  if (!token) {
    console.error('Error: TELEGRAM_BOT_TOKEN not provided. Pass --token or set in .env');
    process.exit(1);
  }

  // 2. Resolve Webhook Secret
  let secret = values.secret || process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const match = fs.readFileSync(envPath, 'utf-8').match(/TELEGRAM_WEBHOOK_SECRET\s*=\s*(.+)/);
      if (match) secret = match[1].trim();
    }
  }

  // 3. Resolve Convex Site URL
  let siteUrl = values.url || process.env.CONVEX_SITE_URL;
  if (!siteUrl) {
    console.error('Error: Convex Site URL not provided.');
    console.error('Usage: npx tsx scripts/set-webhook.ts --url https://<your-deployment>.convex.site');
    process.exit(1);
  }

  siteUrl = siteUrl.replace(/\/+$/, '');
  const webhookUrl = `${siteUrl}/telegram/webhook`;

  console.log(`\n======================================================`);
  console.log(`   Ballast - Telegram Webhook Configuration Tool`);
  console.log(`======================================================\n`);
  console.log(`Target Webhook URL: ${webhookUrl}`);
  console.log(`Secret Token Set:   ${secret ? 'YES (Verified Header Protection)' : 'NO'}`);
  console.log(`Drop Pending:       ${values.drop ? 'YES' : 'NO'}\n`);

  // 4. Call setWebhook Telegram API
  const params: Record<string, any> = {
    url: webhookUrl,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: Boolean(values.drop),
  };

  if (secret) {
    params.secret_token = secret;
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const resJson = await response.json() as { ok: boolean; description?: string; result?: any };

  if (!resJson.ok) {
    console.error(`Failed to set Telegram webhook:`, resJson.description);
    process.exit(1);
  }

  console.log(`Webhook set successfully:`, resJson.description || 'OK');

  // 5. Verify Webhook Status
  const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
  const infoJson = await infoRes.json() as { ok: boolean; result?: any };

  if (infoJson.ok && infoJson.result) {
    console.log('\nVerified Webhook Info from Telegram:');
    console.log(`- URL:                  ${infoJson.result.url}`);
    console.log(`- Has Custom Cert:      ${infoJson.result.has_custom_certificate}`);
    console.log(`- Pending Updates:      ${infoJson.result.pending_update_count}`);
    console.log(`- Last Error Date:      ${infoJson.result.last_error_date ? new Date(infoJson.result.last_error_date * 1000).toISOString() : 'None'}`);
    console.log(`- Last Error Message:   ${infoJson.result.last_error_message || 'None'}`);
  }

  console.log('\nTelegram Bot is now operating 100% in webhook mode on Convex.\n');
}

main().catch((err) => {
  console.error('Fatal error setting webhook:', err);
  process.exit(1);
});
