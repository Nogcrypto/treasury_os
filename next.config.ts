import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@kamino-finance/klend-sdk",
    "@kamino-finance/farms-sdk",
    "@kamino-finance/kliquidity-sdk",
    "@kamino-finance/scope-sdk",
    "@solana/web3.js",
    "@solana/wallet-adapter-base",
    "@solana/wallet-adapter-phantom",
    "@solana/wallet-adapter-react",
    "@solana/wallet-adapter-react-ui",
    "@coral-xyz/anchor",
    "rpc-websockets",
  ],
};

export default withNextIntl(nextConfig);
