import { lightTheme, darkTheme, Theme } from '@rainbow-me/rainbowkit';

/**
 * Custom RainbowKit Theme for Ballast.
 * Styled to match the private-bank ledger and ship's instrument panel aesthetic:
 * - Warm paper (#F4F1EA, #FBFAF6) in light mode
 * - Deep ink (#0E0E0C, #151512) in dark mode
 * - Sharp 2px to 4px instrument corner radii
 * - Hairline borders with zero neon, zero gradients, zero backdrop blur
 * - High-contrast editorial typography
 */
export function getBallastRainbowTheme(theme: 'light' | 'dark'): Theme {
  const isDark = theme === 'dark';

  const baseTheme = isDark
    ? darkTheme({
        accentColor: '#EDE9DF',
        accentColorForeground: '#0E0E0C',
        borderRadius: 'small',
        fontStack: 'system',
        overlayBlur: 'none',
      })
    : lightTheme({
        accentColor: '#14130F',
        accentColorForeground: '#FBFAF6',
        borderRadius: 'small',
        fontStack: 'system',
        overlayBlur: 'none',
      });

  return {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      accentColor: isDark ? '#EDE9DF' : '#14130F',
      accentColorForeground: isDark ? '#0E0E0C' : '#FBFAF6',
      actionButtonBorder: isDark ? 'rgba(237, 233, 223, 0.14)' : 'rgba(20, 19, 15, 0.14)',
      actionButtonBorderMobile: isDark ? 'rgba(237, 233, 223, 0.14)' : 'rgba(20, 19, 15, 0.14)',
      actionButtonSecondaryBackground: isDark ? '#0E0E0C' : '#F4F1EA',
      closeButton: isDark ? '#EDE9DF' : '#14130F',
      closeButtonBackground: isDark ? '#151512' : '#FBFAF6',
      connectButtonBackground: isDark ? '#EDE9DF' : '#14130F',
      connectButtonInnerBackground: isDark ? '#EDE9DF' : '#14130F',
      connectButtonText: isDark ? '#0E0E0C' : '#FBFAF6',
      connectionIndicator: '#2F6F5E', // safe verdigris
      error: '#A32020', // danger oxide red
      modalBackground: isDark ? '#151512' : '#FBFAF6',
      modalBorder: isDark ? 'rgba(237, 233, 223, 0.14)' : 'rgba(20, 19, 15, 0.14)',
      modalText: isDark ? '#EDE9DF' : '#14130F',
      modalTextDim: isDark ? '#8F8A7C' : '#6B675C',
      modalTextSecondary: isDark ? '#8F8A7C' : '#6B675C',
      profileAction: isDark ? '#151512' : '#FBFAF6',
      profileActionHover: isDark ? '#0E0E0C' : '#F4F1EA',
      profileForeground: isDark ? '#151512' : '#FBFAF6',
      selectedOptionBorder: isDark ? '#EDE9DF' : '#14130F',
      standby: '#B7791F', // watch amber
    },
    radii: {
      actionButton: '2px',
      connectButton: '2px',
      menuButton: '2px',
      modal: '4px',
      modalMobile: '4px',
    },
    shadows: {
      connectButton: 'none',
      dialog: '0 4px 16px rgba(0, 0, 0, 0.12)',
      profileDetailsAction: 'none',
      selectedOption: 'none',
      selectedWallet: 'none',
      walletLogo: 'none',
    },
    fonts: {
      body: 'var(--font-instrument), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
  };
}
