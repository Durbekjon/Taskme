# Stage 1: Dependencies
FROM node:20-alpine AS dependencies
WORKDIR /app

# Copy package files
COPY package*.json yarn.lock* ./

# Install dependencies
RUN if [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
    elif [ -f package-lock.json ]; then npm ci; \
    else echo "Lockfile not found." && exit 1; \
    fi

# Stage 2: Build
FROM node:20-alpine AS build
WORKDIR /app

# Copy package files
COPY package*.json yarn.lock* ./

# Install all dependencies (including devDependencies) for building
RUN if [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
    elif [ -f package-lock.json ]; then npm ci; \
    else echo "Lockfile not found." && exit 1; \
    fi

# Copy source code and Prisma schema
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build the application
RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS production
WORKDIR /app

# Install dumb-init and PostgreSQL client tools for backups
RUN apk add --no-cache dumb-init postgresql-client

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Copy package files
COPY package*.json yarn.lock* ./

# Install production dependencies and seed-related dev dependencies
# We need ts-node and @types/bcrypt for running seed script
RUN if [ -f yarn.lock ]; then \
      yarn install --frozen-lockfile --production && \
      yarn add --dev ts-node@latest @types/bcrypt@latest typescript@latest --frozen-lockfile && \
      yarn cache clean; \
    elif [ -f package-lock.json ]; then \
      npm ci --only=production && \
      npm install --save-dev ts-node@latest @types/bcrypt@latest typescript@latest && \
      npm cache clean --force; \
    else echo "Lockfile not found." && exit 1; \
    fi

# Copy Prisma schema and seed config
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/tsconfig.seed.json ./tsconfig.seed.json

# Generate Prisma Client in production stage (required for runtime)
RUN npx prisma generate

# Copy built application
COPY --from=build /app/dist ./dist

# Copy public directory for static assets
COPY public ./public

# Create uploads directory and set permissions
RUN mkdir -p public/uploads && \
    chown -R nestjs:nodejs /app

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/api/v1/payment/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/src/main.js"]

