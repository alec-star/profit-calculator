/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: "/",
        destination: "/breakeven-roas-profit-calculator",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
