import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@api/client", "@api/sdk"],
  output: "standalone",
  turbopack: {},
};

export default nextConfig;