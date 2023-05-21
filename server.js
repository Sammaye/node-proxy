const express = require("express");
const tls = require('tls');
const SslCertificate = require("./models/SslCertificate");
const NodeCache = require( "node-cache" );
const myCache = new NodeCache();

const app = express();

const baseCert = `-----BEGIN CERTIFICATE-----

-----END CERTIFICATE-----

-----BEGIN CERTIFICATE-----

-----END CERTIFICATE-----

-----BEGIN CERTIFICATE-----

-----END CERTIFICATE-----`;
const basePrivateKey = `-----BEGIN PRIVATE KEY-----

-----END PRIVATE KEY-----`;

require("./routes").appPromise.then(routes => {
    app.use('/', routes);

    var port = normalizePort(process.env.PORT || 80);
    const server = app.listen(port, _ => {
        var addr = server.address();
        var bind = typeof addr === 'string'
            ? 'pipe ' + addr
            : 'port ' + addr.port;
        console.log(`Listening on ${bind}`);
    }).on('error', (error) => {
        if (error.syscall !== 'listen') {
            throw error;
        }

        var bind = typeof port === 'string'
            ? 'Pipe ' + port
            : 'Port ' + port;

        // handle specific listen errors with friendly messages
        switch (error.code) {
            case 'EACCES':
                console.log(`${bind} requires elevated privileges`);
                process.exit(1);
                break;
            case 'EADDRINUSE':
                console.log(`${bind} is already in use`);
                process.exit(1);
                break;
            default:
                throw error;
        }
    });

    server.headersTimeout = 5000;
    server.requestTimeout = 10000;
    server.setTimeout(30000);
    server.connectionsCheckingInterval = 500;

    const sslServer = require('https').Server({
        cert: baseCert,
        key: basePrivateKey,
        SNICallback: (serverName, callback) => {
            if (!serverName || serverName.length <= 0) {
                callback(null, new tls.createSecureContext({
                    cert: baseCert,
                    key: basePrivateKey
                }));
                return;
            }

            // TODO make a cronjob that loads all certificates into memory and updates once every minute
            // This is a serious DDOS waiting to happen
            const cachedCertificate = myCache.get(serverName);
            if (cachedCertificate !== undefined) {
                callback(null, new tls.createSecureContext(cachedCertificate ? {
                    cert: cachedCertificate.certificate,
                    key: cachedCertificate.private_key,
                } : {
                    cert: baseCert,
                    key: basePrivateKey
                }));
                return;
            }

            const certificate = SslCertificate.default.findOne({
                domain: serverName,
                isVerified: true,
            }).exec().then(certificate => {
                if (certificate) {
                    myCache.set(serverName, {
                        certificate: certificate.certificate,
                        private_key: certificate.private_key,
                    }, 300);
                } else {
                    myCache.set(serverName, null, 60);
                }

                callback(null, new tls.createSecureContext(certificate ? {
                    cert: certificate.certificate,
                    key: certificate.private_key,
                } : {
                    cert: baseCert,
                    key: basePrivateKey
                }));
            });
        },
    }, app);

    var sslPort = normalizePort(process.env.SSL_PORT || 443);
    sslServer.listen(sslPort, _ => {
        var addr = sslServer.address();
        var bind = typeof addr === 'string'
            ? 'pipe ' + addr
            : 'port ' + addr.port;
        console.log(`Listening on ${bind}`);
    }).on('error', (error) => {
        if (error.syscall !== 'listen') {
            throw error;
        }

        var bind = typeof port === 'string'
            ? 'Pipe ' + port
            : 'Port ' + port;

        // handle specific listen errors with friendly messages
        switch (error.code) {
            case 'EACCES':
                console.log(`${bind} requires elevated privileges`);
                process.exit(1);
                break;
            case 'EADDRINUSE':
                console.log(`${bind} is already in use`);
                process.exit(1);
                break;
            default:
                throw error;
        }
    });

    sslServer.headersTimeout = 5000;
    sslServer.requestTimeout = 10000;
    sslServer.setTimeout(30000);
    sslServer.connectionsCheckingInterval = 500;
}).catch(err => {
    throw err;
});

/**
 * Normalize a port into a number, string, or false.
 */
function normalizePort(val) {
    var port = parseInt(val, 10);

    if (isNaN(port)) {
        // named pipe
        return val;
    }

    if (port >= 0) {
        // port number
        return port;
    }

    return false;
}
