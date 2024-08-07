const fs = require('fs');
const path = require('path');

// CONFIGURATION
const prefix = '/web';  // Set your prefix here
const localAddresses = [];  // Set your local addresses here
const blockedHostnames = ["https://sevenworks.eu.org/bad-site"];  // Set your blocked hostnames here
const index_file = 'index.html'; // Set index file shown by the browser
// END OF CONFIGURATION

const proxy = new (require('./lib/index'))(prefix, {
  localAddress: localAddresses,
  blacklist: blockedHostnames
});

const atob = str => Buffer.from(str, 'base64').toString('utf-8');

module.exports.handler = async (event) => {
  const req = {
    url: event.path,
    method: event.httpMethod,
    queryStringParameters: event.queryStringParameters || {}
  };

  const res = {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html' },
    body: '',
    setHeader: (name, value) => { this.headers[name] = value; },
    end: (body) => { this.body = body; }
  };

  if (req.url.startsWith(prefix)) {
    // Handle proxy requests
    await proxy.http(req, res);
    return {
      statusCode: res.statusCode,
      headers: res.headers,
      body: res.body
    };
  }

  req.pathname = req.url.split('#')[0].split('?')[0];
  req.query = req.queryStringParameters;

  if (req.query.url && (req.pathname === '/prox' || req.pathname === '/prox/' || req.pathname === '/session' || req.pathname === '/session/')) {
    let url = atob(req.query.url);

    if (!url.startsWith('https://') && !url.startsWith('http://')) {
      url = url.startsWith('//') ? 'http:' + url : 'http://' + url;
    }

    return {
      statusCode: 301,
      headers: { Location: prefix + proxy.proxifyRequestURL(url) },
      body: ''
    };
  }

  const publicPath = path.join(__dirname, 'public', req.pathname);

  try {
    const stats = fs.statSync(publicPath);

    if (stats.isDirectory()) {
      const indexPath = path.join(publicPath, index_file);
      if (fs.existsSync(indexPath)) {
        res.body = fs.readFileSync(indexPath, 'utf-8');
      } else {
        throw new Error('File not found');
      }
    } else if (stats.isFile()) {
      res.body = fs.readFileSync(publicPath, 'utf-8');
    } else {
      throw new Error('File not found');
    }
  } catch (err) {
    res.statusCode = 404;
    res.body = fs.readFileSync(path.join(__dirname, 'lib', 'error.html'), 'utf-8').replace('%ERR%', `Cannot ${req.method} ${req.pathname}`);
  }

  return {
    statusCode: res.statusCode,
    headers: res.headers,
    body: res.body
  };
};
