FROM node:20-alpine AS base
WORKDIR /app
# Use pnpm from `package.json` `"packageManager"` (required for `pnpm-lock.yaml`)
RUN corepack enable

# Install dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/Vibe-Workflow/packages/workflow-builder/package.json ./packages/Vibe-Workflow/packages/workflow-builder/
COPY packages/Open-Poe-AI/packages/agents/package.json ./packages/Open-Poe-AI/packages/agents/
COPY packages/studio/package.json ./packages/studio/
RUN pnpm install --frozen-lockfile

# Build workspace packages + Next.js app
FROM deps AS builder
COPY . .
RUN pnpm run build:packages
RUN pnpm run build

# Production runner
FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000
CMD ["pnpm", "exec", "next", "start"]
