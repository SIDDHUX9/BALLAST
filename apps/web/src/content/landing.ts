import {
  BRAND_NAME,
  BRAND_TAGLINE,
  BRAND_DESCRIPTION,
  BRAND_URLS,
  PROTOCOL_CONSTANTS,
} from '@ballast/shared';

const MCR_PERCENT = Number(PROTOCOL_CONSTANTS.MCR / 10n ** 16n); // 110%

export interface LandingContent {
  brand: {
    name: typeof BRAND_NAME;
    tagline: typeof BRAND_TAGLINE;
    description: typeof BRAND_DESCRIPTION;
    urls: typeof BRAND_URLS;
  };
  header: {
    navItems: readonly { label: string; href: string }[];
    launchButton: { label: string; href: string };
  };
  hero: {
    eyebrow: string;
    headline: {
      line1: string;
      line2: string;
      line3ItalicEmber: string;
    };
    body: string;
    ctaPrimary: { label: string; href: string };
    ctaSecondary: { label: string; href: string };
    note: string;
    card: {
      title: string;
      pill: string;
      tag: string;
      ratioLabel: string;
      initialCollateralUSD: number;
      initialDebtUSD: number;
      triggerPercent: number;
      targetPercent: number;
      tickLabels: {
        liquidation: string;
        trigger: string;
        target: string;
      };
    };
    proofItems: readonly {
      title: string;
      description: string;
    }[];
  };
  problem: {
    eyebrow: string;
    headline: {
      line1: string;
      line2: string;
      line3ItalicEmber: string;
      line4ItalicEmber: string;
    };
    body: string;
    link: { label: string; href: string };
    note: string;
  };
  howItWorks: {
    eyebrow: string;
    headline: {
      regular: string;
      highlight: string;
    };
    note: string;
    steps: readonly {
      number: string;
      title: string;
      description: string;
    }[];
  };
  simulator: {
    eyebrow: string;
    headline: {
      line1: string;
      line2: string;
    };
    body: string;
    cta: { label: string; href: string };
    card: {
      title: string;
      scenarioTag: string;
      presets: readonly string[];
      metricLabels: {
        ratio: string;
        debt: string;
        collateral: string;
      };
      sliderLabels: {
        drop: string;
        reserve: string;
        trigger: string;
      };
      chartLegend: {
        withoutBallast: string;
        withBallast: string;
        liquidation: string;
      };
      caption: string;
    };
  };
  belief: {
    eyebrow: string;
    headline: {
      line1: string;
      line2: string;
      line3: string;
    };
    body: string;
    ctaPrimary: { label: string; href: string };
    ctaSecondary: { label: string; href: string };
    caption: string;
    note: string;
    stamp: string;
  };
  footer: {
    tagline: string;
    alertsWidget: {
      buttonLabel: string;
      caption: string;
      botUrl: string;
      appAlertsUrl: string;
    };
    protocolLinks: readonly { label: string; href: string }[];
    communityLinks: readonly { label: string; href: string }[];
    copyright: string;
    note: string;
  };
  metadata: {
    title: string;
    description: string;
  };
}

export const LANDING_CONTENT: LandingContent = {
  brand: {
    name: BRAND_NAME,
    tagline: BRAND_TAGLINE,
    description: BRAND_DESCRIPTION,
    urls: BRAND_URLS,
  },
  header: {
    navItems: [
      { label: 'How it works', href: '#how-it-works' },
      { label: 'Stress test', href: '#simulator' },
      { label: 'Security', href: '#belief' },
      { label: 'Docs', href: BRAND_URLS.mezoDocs },
    ] as const,
    launchButton: {
      label: 'Launch App',
      href: '/app',
    },
  },
  hero: {
    eyebrow: 'MUSD LIQUIDATION PROTECTION · MEZO',
    headline: {
      line1: 'Your Position.',
      line2: ' Your Rules.',
      line3ItalicEmber: 'Ballast Defense',
    },
    body: 'Ballast defends your MUSD loan on Mezo. Set a trigger, fund a reserve, and your position is repaid or topped up before it nears liquidation.',
    ctaPrimary: {
      label: 'Launch App',
      href: '/app',
    },
    ctaSecondary: {
      label: 'See how it works',
      href: '#how-it-works',
    },
    note: 'SAME MARKET.\nA SAFETY NET.',
    card: {
      title: 'Example position',
      pill: 'Healthy',
      tag: 'Illustrative',
      ratioLabel: 'COLLATERAL RATIO',
      initialCollateralUSD: 10000,
      initialDebtUSD: 6000,
      triggerPercent: 135,
      targetPercent: 160,
      tickLabels: {
        liquidation: `${MCR_PERCENT}% Liquidation`,
        trigger: '135% Trigger',
        target: '160% Target',
      },
    },
    proofItems: [
      {
        title: 'Automatic defense',
        description: 'Repays debt or adds BTC from your reserve',
      },
      {
        title: 'Stress-tested',
        description: 'See what a price drop does to your loan',
      },
      {
        title: 'You hold the keys',
        description: 'Your vault, no admin keys',
      },
    ] as const,
  },
  problem: {
    eyebrow: 'THE PROBLEM',
    headline: {
      line1: 'Prices move',
      line2: 'fast.',
      line3ItalicEmber: 'Liquidation',
      line4ItalicEmber: "doesn't wait.",
    },
    body: `On Mezo, a MUSD loan is liquidated once its collateral ratio falls below ${MCR_PERCENT}%. And when MUSD is redeemed, the loans with the lowest ratios are hit first. Watching a chart all day is not a plan.`,
    link: {
      label: 'How liquidation works',
      href: '#how-it-works',
    },
    note: `${MCR_PERCENT}% IS THE LINE.\nSTAY WELL ABOVE IT.`,
  },
  howItWorks: {
    eyebrow: 'HOW IT WORKS',
    headline: {
      regular: 'Set it once.',
      highlight: 'Stay safe.',
    },
    note: 'YOU SET\nTHE LINE.',
    steps: [
      {
        number: '01',
        title: 'Open your vault',
        description:
          'A personal vault holds your MUSD loan. Only you can withdraw from it.',
      },
      {
        number: '02',
        title: 'Set your line',
        description:
          'Choose a trigger and a target ratio, then fund a reserve of MUSD and BTC.',
      },
      {
        number: '03',
        title: 'Defense runs itself',
        description:
          'When your ratio hits the trigger, anyone can repay debt or add collateral from your reserve, back to your target. You get a Telegram alert.',
      },
    ] as const,
  },
  simulator: {
    eyebrow: 'STRESS TEST',
    headline: {
      line1: 'Test your loan',
      line2: 'against a crash.',
    },
    body: 'Drop the BTC price and watch your ratio, your reserve and every defense step, with and without Ballast. In the app, this runs on your real position.',
    cta: {
      label: 'Try the stress test',
      href: '/app/stress-test',
    },
    card: {
      title: 'Stress test',
      scenarioTag: 'Scenario',
      presets: ['-10%', '-20%', '-30%', '-40%'] as const,
      metricLabels: {
        ratio: 'Collateral ratio',
        debt: 'MUSD debt',
        collateral: 'Collateral value',
      },
      sliderLabels: {
        drop: 'BTC price change',
        reserve: 'Reserve (MUSD)',
        trigger: 'Trigger ratio',
      },
      chartLegend: {
        withoutBallast: 'Without Ballast',
        withBallast: 'With Ballast',
        liquidation: `${MCR_PERCENT}% Liquidation`,
      },
      caption: 'A scenario computed from the inputs above, not a prediction.',
    },
  },
  belief: {
    eyebrow: 'OUR BELIEF',
    headline: {
      line1: 'Borrowing against',
      line2: 'Bitcoin should be',
      line3: 'boring.',
    },
    body: "Fewer liquidations mean healthier loans and a steadier Mezo. Ballast sits on top of Mezo's own MUSD contracts: open source, no custody, no admin keys.",
    ctaPrimary: {
      label: 'Launch App',
      href: '/app',
    },
    ctaSecondary: {
      label: 'Read the docs',
      href: BRAND_URLS.mezoDocs,
    },
    caption:
      'Ballast lowers liquidation risk; it cannot remove it. Reserves can run out and prices can gap. Testnet prototype, unaudited.',
    note: 'YOUR POSITION.\nYOUR RULES.',
    stamp: 'BUILT ON MEZO.\nOPEN SOURCE.',
  },
  footer: {
    tagline: BRAND_TAGLINE,
    alertsWidget: {
      buttonLabel: 'Get liquidation alerts on Telegram',
      caption: 'Link your wallet in the app.',
      botUrl: BRAND_URLS.telegramBot,
      appAlertsUrl: '/app/alerts',
    },
    protocolLinks: [
      { label: 'Docs', href: BRAND_URLS.mezoDocs },
      { label: 'GitHub', href: BRAND_URLS.github },
      { label: 'Contracts', href: BRAND_URLS.factoryExplorer },
      { label: 'Security notes', href: BRAND_URLS.securityNotes },
    ] as const,
    communityLinks: [
      { label: 'Mezo Discord', href: BRAND_URLS.discord },
      { label: 'GitHub', href: BRAND_URLS.github },
      { label: 'Telegram bot', href: BRAND_URLS.telegramBot },
      { label: 'X (@Siddhu_3116)', href: BRAND_URLS.x },
    ] as const,
    copyright:
      '© 2026 Ballast. Built for the Mezo Buildathon. Testnet prototype, not financial advice.',
    note: 'STAY AHEAD.\nSTAY IN CONTROL.',
  },
  metadata: {
    title: 'Ballast | Liquidation protection for MUSD on Mezo',
    description:
      'Ballast defends your Bitcoin-backed MUSD loan on Mezo with an automated, non-custodial reserve that anyone can deploy when your collateral ratio drops.',
  },
};
