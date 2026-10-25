/**
 * Single source of truth for Ballast branding.
 * Rules require all components, contracts, scripts, and frontends to import from here.
 */
export const BRAND_NAME = 'Ballast' as const;
export const BRAND_TAGLINE = 'Liquidation protection for MUSD on Mezo' as const;
export const BRAND_DESCRIPTION =
  'Ballast defends your Bitcoin-backed MUSD loan on Mezo with an automated, non-custodial reserve that anyone can deploy when your collateral ratio drops.' as const;

export const BRAND_URLS = {
  github: 'https://github.com/SIDDHUX9/BALLAST',
  twitter: 'https://x.com/Siddhu_3116',
  x: 'https://x.com/Siddhu_3116',
  mezoDocs: 'https://mezo.org/docs/developers',
  mezoExplorer: 'https://explorer.test.mezo.org',
  mezoRpc: 'https://rpc.test.mezo.org',
  appUrl: 'https://ballast.mezo.org',
  telegramBot: 'https://t.me/BALLASTBTC_bot',
  discord: 'https://discord.gg/mezo',
  securityNotes: 'https://github.com/SIDDHUX9/BALLAST/blob/main/docs/THREAT_MODEL.md',
  factoryExplorer: 'https://explorer.test.mezo.org/address/0x8d5b392839300b487addeecc35f5bc534111cd33',
} as const;

