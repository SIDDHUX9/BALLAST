/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@ballast/shared',
    '@mezo-org/passport',
    '@mezo-org/orangekit',
    '@mezo-org/orangekit-contracts',
    '@mezo-org/orangekit-smart-account',
  ],
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  turbopack: {
    resolveAlias: {
      '@x402/core/client': './src/lib/empty-module.js',
      '@x402/evm/exact/client': './src/lib/empty-module.js',
      '@x402/evm/upto/client': './src/lib/empty-module.js',
      '@x402/svm/exact/client': './src/lib/empty-module.js',
      '@x402/evm': './src/lib/empty-module.js',
      '@react-native-async-storage/async-storage': './src/lib/empty-module.js',
    },
  },
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'viem',
      'wagmi',
      '@rainbow-me/rainbowkit',
      '@tanstack/react-query',
      '@mezo-org/orangekit',
      '@mezo-org/passport',
      '@radix-ui/react-dialog',
      '@radix-ui/react-popover',
      '@radix-ui/react-select',
      '@radix-ui/react-slider',
      '@radix-ui/react-switch',
      '@radix-ui/react-tabs',
      '@radix-ui/react-toast',
      '@radix-ui/react-tooltip',
    ],
  },
  webpack: (config, { webpack }) => {
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^@x402/,
      })
    );
    if (process.env.NEXT_PUBLIC_E2E !== '1') {
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /test-connector/,
        })
      );
    }
    config.resolve.fallback = {
      ...config.resolve.fallback,
      '@react-native-async-storage/async-storage': false,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
};

export default nextConfig;
