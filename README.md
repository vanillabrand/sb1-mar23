# sb1-mar23

# Remove node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Clear npm cache
npm cache clean --force

# Reinstall dependencies
npm install

# Build the project
npm run build

# Start in development mode
./scripts/run.sh dev

