import '../config/app';
import Log from '../services/Log';
import express from "express";
import * as Sentry from "@sentry/node";
import Router from "express-promise-router";
import Morgan from 'morgan';
import mongoDB from "../services/MongoDB";
import {createProxyMiddleware, responseInterceptor} from "http-proxy-middleware";
import SslCertificate from "../models/SslCertificate";
var compression = require('compression')

let app = express();

function startUp () {
    return new Promise(async (resolve, reject) => {
        Log.configure(config, app);
        await mongoDB.connect(config);
        return resolve({});
    });
}

const appPromise = startUp().then(data => {

    if (config.LOGS_ENABLE_SENTRY) {
        app.use(Sentry.Handlers.requestHandler());
        app.use(Sentry.Handlers.tracingHandler());
    }

    app.set('trust proxy', true);

    app.use((req, res, next) => {
        req.log = (message, data) => {
                const meta = {
                ...data,
                url: req.originalUrl,
                method: req.method,
                body: req.body,
                headers: req.headers,
            };

            if (message instanceof Error) {
                Log.error(message, meta);
            } else {
                Log.log(message, meta);
            }
        };

        req.error = (error, meta) => {
            req.log(error, meta);
        };

        next();
    }); // Custom logger middleware

    app.use(Morgan('dev'));

    app.use(compression({ filter: shouldCompress }));

    function shouldCompress (req, res) {
        if (req.headers['x-no-compression']) {
            // don't compress responses with this request header
            return false
        }

        // fallback to standard filter function
        return compression.filter(req, res)
    }

    const router = Router();

    router.get('/.well-known/acme-challenge/:token', async (req, res) => {
        const sslCertificate = await SslCertificate.findOne({token: req.params.token}).exec();

        if (!sslCertificate) {
            return res.status(404).send();
        }

        return res.send(sslCertificate.key);
    });

    router.use('*', async (req, res, next) => {
        if (req.protocol === 'http' && config.APP_ENV !== 'DEV') {
            const sslCertificate = await SslCertificate.findOne({domain: req.hostname, isVerified: true}).exec();

            if (sslCertificate) {
                return res.redirect(301, `https://${req.headers.host}${req.url}`);
            }
        }

        next();
    });

    app.use('/', router);

    app.use('*', createProxyMiddleware({
        target: config.PROXY_URL,
        changeOrigin: true,
        selfHandleResponse: true,
        onProxyRes: responseInterceptor(async (responseBuffer, proxyRes, req, res) => {
            let response = responseBuffer.toString('utf8');
            if (response.match(/(<base[ ]*?href=").+(")/)) {
                response = response.replace(/(<base[ ]*?href=").+(")/, "$1" + `${config.PROXY_URL}/` + "$2");
                return response;
            }
            return responseBuffer;
        }),
    }));

    if (config.LOGS_ENABLE_SENTRY) {
        app.use(Sentry.Handlers.errorHandler());
    }

    app.use(function (req, res, next){
        return res.status(404).send();
    })

    app.use(function (err, req, res, next) {
        if (!config.LOGS_ENABLE_SENTRY) {
            req.error(err);
        }

        if (!res.headersSent) {
            return res.status(500).send();
        }
    }); // error handler

    return app;
});

export { appPromise };
