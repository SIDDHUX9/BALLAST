/**
 * Single source of truth for Ballast branding.
 * Rules require all components, contracts, scripts, and frontends to import from here.
 */
export const BRAND_NAME = 'Ballast' as const;
export const BRAND_TAGLINE = 'Liquidation guardian for MUSD troves on Mezo' as const;
export const BRAND_DESCRIPTION =
  'An automated, non-custodial defense system that protects Bitcoin-backed MUSD troves on Mezo from liquidation and redemption by maintaining a pre-funded defense reserve.' as const;

export const BRAND_URLS = {
  github: 'https://github.com/SIDDHUX9/BALLAST',
  twitter: 'https://x.com/Siddhu_3116',
  x: 'https://x.com/Siddhu_3116',
  mezoDocs: 'https://mezo.org/docs/developers',
  mezoExplorer: 'https://explorer.test.mezo.org',
  mezoRpc: 'https://rpc.test.mezo.org',
  appUrl: 'https://ballast.mezo.org',
} as const;
