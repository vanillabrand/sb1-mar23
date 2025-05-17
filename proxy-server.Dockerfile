FROM node:18-alpine@sha256:67633f5851a3af8c c5a6d5b3d661d2c5c7eefac55c1d5124c9a4e3f9e19ba2c

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy proxy server code
COPY proxy-server.js ./

# Expose the port
EXPOSE 3001

# Start the proxy server
CMD ["node", "proxy-server.js"]
