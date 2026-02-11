# Use Node.js 20
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY .npmrc ./

# Install dependencies
RUN npm ci --prefer-offline --no-audit

# Copy source code
COPY . .

# Install Playwright browsers (postinstall script)
RUN npm run postinstall || true

# Expose port (Railway will set PORT env var)
EXPOSE 3001

# Start server
CMD ["npm", "run", "server"]
