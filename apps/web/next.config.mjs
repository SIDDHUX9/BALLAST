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
