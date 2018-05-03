const path  = require('path');
const fs    = require('fs');

// No dark magic, using path.join to normalize the config file name
// then reading it synchronously (exports doesn't support async yet)
// and parsing JSON data to object
module.exports = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'config.json')));
