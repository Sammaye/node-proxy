const express = require("express");
const tls = require('tls');
const SslCertificate = require("./models/SslCertificate");

const app = express();

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

    const sslServer = require('https').Server({
        SNICallback: (serverName, callback) => {
            const certificate = SslCertificate.default.findOne({
                domain: serverName,
                isVerified: true,
            }).exec().then(certificate => {
                callback(null, new tls.createSecureContext(certificate ? {
                    cert: certificate.certificate,
                    key: certificate.private_key,
                } : {}));
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
