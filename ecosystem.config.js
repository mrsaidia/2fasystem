module.exports = {
  apps: [{
    name: '2fa-system',
    script: 'server.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env_file: '.env',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      JWT_SECRET: 'aB3$9Kx7#mP2!vR8@qL5&wN4^tS6*uY1$9zM3&nQ8@rT4',
      HIDDEN_CODE: '98765'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
      JWT_SECRET: 'aB3$9Kx7#mP2!vR8@qL5&wN4^tS6*uY1$9zM3&nQ8@rT4',
      HIDDEN_CODE: '98765'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
} 