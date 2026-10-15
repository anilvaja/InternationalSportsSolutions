module.exports = {
  apps: [
    {
      name: 'iss-sports-saas',
      script: 'server.js',
      instances: 1, // SQLite operates best with single process + WAL mode or fork mode
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'development',
        PORT: 3005,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3005,
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: 'storage/logs/pm2-error.log',
      out_file: 'storage/logs/pm2-out.log',
      merge_logs: true,
    },
  ],
};
