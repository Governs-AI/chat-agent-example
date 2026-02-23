/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    env: {
      // Public config — safe to expose to the browser
      PROVIDER: process.env.PROVIDER,
      PRECHECK_URL: process.env.PRECHECK_URL,
      DEMO_USER_ID: process.env.DEMO_USER_ID,
      OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL,
      OLLAMA_MODEL: process.env.OLLAMA_MODEL,
      // NOTE: PRECHECK_API_KEY and FIRECRAWL_API_KEY are intentionally NOT listed
      // here. Access them server-side only via process.env.PRECHECK_API_KEY etc.
      // Adding secrets to the `env` block inlines them into the browser bundle.
    },
};

export default nextConfig;
