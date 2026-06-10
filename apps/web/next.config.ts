import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  transpilePackages: ['@qauto/shared-types', '@qauto/api-client', '@qauto/ui'],
  outputFileTracingRoot: path.join(__dirname, '../..'),
  experimental: {
    optimizePackageImports: ['@qauto/ui'],
  },
};

export default nextConfig;