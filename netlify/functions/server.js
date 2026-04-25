const serverless = require('serverless-http');
const app = require('../../license-server');

module.exports.handler = serverless(app);
