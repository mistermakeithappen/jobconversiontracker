export default {
  apps: [{
    name: 'workflow-automation',
    script: 'npm',
    args: 'run dev',
    cwd: './workflow-automation',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production'
    },
    // PM2 options
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '1G',
    restart_delay: 4000,
    // Logging
    log_file: './logs/app.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    // Auto restart
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s'
  }]
}