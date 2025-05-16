FROM node:18-alpine

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
