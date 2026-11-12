// PM2 process for the Ayush ALL IN ONE API on 156.67.104.242.
// Started by scripts/deploy.py: pm2 startOrReload deploy/ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'ayushallinone',
      cwd: '/opt/projects/ayushallinone/backend',
      script: 'src/server.js',
      // HOST 127.0.0.1: only nginx on this server can reach the API, not the internet.
      env: { NODE_ENV: 'production', PORT: 5160, HOST: '127.0.0.1' },
      max_memory_restart: '600M',
      time: true,
    },
  ],
};
