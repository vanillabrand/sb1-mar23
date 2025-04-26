module.exports = {
  apps: [
    {
      name: 'proxy-server',
      script: 'proxy-server.js',
      env: {
        PROXY_PORT: 3001,
        NODE_ENV: 'development'
      },
      env_production: {
        PROXY_PORT: 3001,
        NODE_ENV: 'production'
      },
      watch: process.env.NODE_ENV !== 'production',
      max_memory_restart: '500M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'dev-server',
      script: 'node_modules/.bin/vite',
      env: {
        NODE_ENV: 'development'
      },
      // Only run in development mode
      autorestart: process.env.NODE_ENV !== 'production'
    }
  ]
};
