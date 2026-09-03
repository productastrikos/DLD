/**
 * PM2 process definition for a Hostinger VPS without Docker.
 *
 *   npm ci && npm run build
 *   pm2 start ecosystem.config.cjs && pm2 save && pm2 startup
 */
module.exports = {
  apps: [
    {
      name: 'dld-platform',
      script: 'app.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '400M',
      env: {
        NODE_ENV: 'production',
        HOST: '0.0.0.0',
        PORT: 5061,
      },
    },
  ],
};
