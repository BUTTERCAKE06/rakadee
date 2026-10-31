const http = require('http');
const config = require('./config');
const app = require('./app');
const { initSocket } = require('./socket');
const { startJobs } = require('./jobs');

const server = http.createServer(app);
initSocket(server);
startJobs();

server.listen(config.port, () => {
  console.log(`Rakadee running at http://localhost:${config.port} (${config.env})`);
});
