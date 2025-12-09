# GovernsAI Chat Agent Example Dockerfile
FROM node:20-alpine AS base

# Install pnpm
RUN npm install -g pnpm

# ----------------------------------------
# Builder Stage
# ----------------------------------------
FROM base AS builder
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* ./

# Install all dependencies
RUN pnpm install

# Copy the rest of the application
COPY . .

# Build the application
RUN pnpm run build

# ----------------------------------------
# Runner Stage (Standard Mode)
# ----------------------------------------
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Install wget for health checks
RUN apk add --no-cache wget

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# 1. Copy package.json (needed for "pnpm start")
COPY --from=builder /app/package.json ./package.json

# 2. Copy the public folder
COPY --from=builder /app/public ./public

# 3. Copy the built .next folder (The standard build output)
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next

# 4. Copy node_modules (REQUIRED for standard mode)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

# Set ownership
USER nextjs

# Expose port
EXPOSE 3000
ENV PORT=3000

# Health check (Adjusted for standard start)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# 5. Start command using standard Next.js start
CMD ["pnpm", "start"]