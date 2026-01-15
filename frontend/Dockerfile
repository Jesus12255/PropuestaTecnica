# Build and Run Stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for vite preview)
RUN npm ci

# Copy source code
COPY . .

# Pass backend URL as environment variable for build time
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

# Build the app to generate dist/
RUN npm run build

# Cloud Run defaults variable
ENV PORT=8080

# Expose port (Cloud Run defaults to 8080)
EXPOSE 8080

# Configure health check for Vite Preview
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

CMD ["sh", "-c", "npm run preview -- --host --port $PORT"]
