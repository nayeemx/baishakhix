module.exports = {
  apps: [{
    name: 'baishakhi',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/baishakhi',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '1G',
    error_file: '/var/log/pm2/baishakhi-error.log',
    out_file: '/var/log/pm2/baishakhi-out.log',
    log_file: '/var/log/pm2/baishakhi-combined.log',
    time: true,
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    restart_delay: 4000,
    max_restarts: 10,
    min_uptime: '10s'
  }],

  deploy: {
    production: {
      user: 'root',
      host: '104.161.43.50',
      ref: 'origin/main',
      repo: 'git@github.com:yourusername/baishakhi.git',
      path: '/var/www/baishakhi',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production'
    }
  }
};
