module.exports = {
  apps: [
    {
      name: 'proxy-server',
      script: 'proxy-server.js',
      env: {
        PROXY_PORT: 3001
      }
    },
    {
      name: 'dev-server',
      script: 'node_modules/.bin/vite',
      env: {
        NODE_ENV: 'development'
      }
    }
  ]
};
