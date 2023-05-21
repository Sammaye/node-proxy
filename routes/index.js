import '../config/app';
import Log from '../services/Log';
import express from "express";
import * as Sentry from "@sentry/node";
import Router from "express-promise-router";
import Morgan from 'morgan';
import mongoDB from "../services/MongoDB";
import {createProxyMiddleware, responseInterceptor} from "http-proxy-middleware";
import SslCertificate from "../models/SslCertificate";
var compression = require('compression');
import Path from 'node:path';
import Net from 'node:net';
//const AWS = require('aws-sdk');
//const helmet = require('helmet');
//const NodeCache = require( "node-cache" );
//const myCache = new NodeCache();

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

    // These headers force same origin loading of JS etc which breaks the page atm
    //app.use(helmet());

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

    Morgan.token('protocol', function (req, res) { return req.protocol });
    app.use(Morgan(':remote-addr - :remote-user [:date[clf]] ":method :protocol :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" - :response-time ms'));

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

    // TODO maybe remove this and use dns-01 validation only? This could be a DDOS vulnerability
    router.get('/.well-known/acme-challenge/:token', async (req, res) => {
        const sslCertificate = await SslCertificate.findOne(
            {token: req.params.token},
            {key: 1, _id: 0}
        ).exec();

        if (!sslCertificate) {
            return res.status(404).send();
        }

        return res.send(sslCertificate.key);
    });

    router.get('/robots.txt', async (req, res) => {
        res.setHeader('content-type', 'text/plain');
        return res.send("User-agent: *\r\nDisallow: /");
    });

    router.get('/sitemap*', async (req, res) => {
        return res.status(404).send();
    });

    router.use('*', async (req, res, next) => {
        if (!req.hostname) {
            // Ban all who cannot be bothered to give me a hostname
            return res.status(500).send();
        }

        // Only allow index.html ban all other pages
        let path_without_slashes = (req.baseUrl + req.path).replace(/^\/|\/$/g, '');
        const extname = Path.extname(path_without_slashes);
        if (extname && !path_without_slashes.includes('index.html')) {
            return res.status(404).send();
        }

        // just ban IPs, in dev you should use HOSTS file to pretend DNS
        if (Net.isIP(req.hostname)) {
            return res.status(404).send();
        }

        // Redirect anything not localhost to https
        if (req.protocol === 'http' && !req.hostname.includes('localhost')) {
            // We have a default cert for our domains
            return res.redirect(301, `https://${req.hostname}${req.url}`);
        }

        next();
    });

    /*
     * This is an old version which used S3 directly, it was superseded for proxy
     * I kept it here since I am unsure if it is actually better than the proxy
     * This would also allow us to reduce the compression by half CPU since it does
     * not need to reverse compression and then compress. This function can also be contained
     * to just the index.html rather than proxying the whole application so could reduce
     * CPU and memory strain on requests
     *
     * Warning: since we don't know when an application is released on S3 this seems like it wouldn't
     * be much better after all, we would need some way of clering cache on this server to not break
     * sites.
     *
    const s3 = new AWS.S3({
        accessKeyId: config.S3_ACCESS_KEY_ID || null,
        secretAccessKey: config.S3_SECRET_KEY || null
    });

    router.get('*', async (req, res) => {
        try {
            let key = (req.baseUrl + req.path).replace(/^\/|\/$/g, '');

            const extname = Path.extname(key);
            if (!extname || !key || key === '/') {
                key = 'index.html';

                const cachedResponse = myCache.get(key);

                let response = cachedResponse.response || null;
                let contentType = cachedResponse.contentType || null;
                let contentLength = cachedResponse.contentLength || null;

                if (cachedResponse === undefined) {
                    const objParams = {Bucket: config.S3_BUCKET_NAME, Key: key};

                    const metadata = await s3
                        .headObject(objParams)
                        .promise()
                        .then(
                            (d) => d,
                            err => {
                                if (err.code === 'NotFound') {
                                    return false;
                                }
                                throw err;
                            }
                        );

                    if (!metadata) {
                        return res.status(404).send();
                    }

                    const commonFileAsStream = await s3.getObject(objParams).createReadStream();
                    response = commonFileAsStream.toString('utf8');

                    contentLength = metadata.ContentLength;
                    contentType = metadata.ContentType;

                    myCache.set(key, {contentType, contentLength, response}, 600);
                }

                if (response.match(/(<base[ ]*?href=").+(")/)) {
                    response = response.replace(/(<base[ ]*?href=").+(")/, "$1" + `${config.PROXY_URL}/` + "$2");
                    return response;
                }

                res.set('Content-type', contentType);
                res.set('Content-Length', contentLength);
                return res.send(response);
            } else {
                res.redirect(301, config.PROXY_URL + '/' + key);
            }
        } catch (err) {
            if (err instanceof Error && err.requestId) {
                // This is a workaround for errors that have custom
                // properties, like AWS SDK errors, they do not seem to work
                // with Winston `winston.format.errors({stack: true})` so
                // we copy the error object to a new fresh error object which seems to work
                const errc = new Error(err.message);
                errc.stack = err.stack;
                err = errc;
            }

            throw err;
        }
    });
     */

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
