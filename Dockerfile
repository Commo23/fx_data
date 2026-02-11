# Use Node.js 20 with Debian (better for Playwright)
FROM node:20-slim

WORKDIR /app

# Install system dependencies required by Playwright
RUN apt-get update && \
    apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libwayland-client0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    libu2f-udev \
    libvulkan1 \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./
COPY .npmrc ./

# Install dependencies (postinstall will install Playwright browsers)
RUN npm ci --prefer-offline --no-audit

# Copy source code
COPY . .

# Expose port (Railway will set PORT env var)
EXPOSE 3001

# Start server
CMD ["npm", "run", "server"]
