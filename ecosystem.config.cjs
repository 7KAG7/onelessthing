module.exports = {
  apps: [
    {
      name: 'onelessthing',
      script: 'dist/server.js',
      cwd: '/var/www/onelessthing',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
};
