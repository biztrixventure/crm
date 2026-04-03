FROM node:18-alpine

# Install wget for health checks
RUN apk add --no-cache wget

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev || npm install --omit=dev

# Copy source code
COPY src ./src

# Copy .env file if exists (for local testing)
COPY .env* ./

# Expose port
EXPOSE 4000

# Health check with longer start period
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
  CMD wget -q --spider http://localhost:4000/api/v1/health || exit 1

# Start the application
CMD ["node", "src/index.js"]
