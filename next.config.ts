import type { NextConfig } from 'next';

const config: NextConfig = {
  // standalone output keeps the Docker image small (Chris's Dockerfile relies on it)
  output: 'standalone',
};

export default config;
