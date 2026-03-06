/**
 * PM2 Ecosystem Configuration for Playlist Lab
 * 
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 save
 *   pm2 startup
 */

module.exports = {
  apps: [
    {
      // Application name
      name: 'playlist-lab-server',
      
      // Application directory
      cwd: '/opt/playlist-lab/apps/server',
      
      // Script to execute
      script: 'dist/index.js',
      
      // Execution mode
      instances: 1,
      exec_mode: 'cluster',
      
      // Environment variables
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        DATABASE_PATH: '/var/lib/playlist-lab/playlist-lab.db',
      },
      
      // Load additional environment from file
      env_file: '/opt/playlist-lab/.env.production',
      
      // Logging
      error_file: '/var/log/playlist-lab/pm2-error.log',
      out_file: '/var/log/playlist-lab/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Restart policy
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000,
      
      // Watch and reload (disable in production)
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'data'],
      
      // Advanced features
      kill_timeout: 5000,
      listen_timeout: 3000,
      shutdown_with_message: true,
      
      // Monitoring
      max_memory_restart: '500M',
      
      // Source map support
      source_map_support: true,
      
      // Instance variables
      instance_var: 'INSTANCE_ID',
    },
  ],
  
  // Deployment configuration (optional)
  deploy: {
    production: {
      user: 'playlist-lab',
      host: 'your-server.com',
      ref: 'origin/main',
      repo: 'git@github.com:yourusername/playlist-lab.git',
      path: '/opt/playlist-lab',
      'post-deploy': 'npm ci && npm run build:prod && pm2 reload ecosystem.config.js --env production',
      'pre-setup': 'mkdir -p /var/lib/playlist-lab /var/log/playlist-lab',
    },
  },
};
