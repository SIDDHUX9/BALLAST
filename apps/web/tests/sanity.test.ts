import { describe, it, expect } from 'vitest';
import { BRAND_NAME, BRAND_TAGLINE } from '@ballast/shared';

describe('Web Application Sanity Tests', () => {
  it('loads branding constants properly from shared package', () => {
    expect(BRAND_NAME).toBe('Ballast');
    expect(BRAND_TAGLINE).toBe('Liquidation guardian for MUSD troves on Mezo');
  });

  it('verifies Next.js app environment defaults to non-E2E in production', () => {
    expect(process.env.NEXT_PUBLIC_E2E).not.toBe('1');
  });
});
