import winston from 'winston';
import AWS from "aws-sdk";
import WinstonCloudwatch from "winston-cloudwatch";
import * as Sentry from "@sentry/node";
import * as Tracing from "@sentry/tracing";

// safely handles circular references
function JSONSafeStringify(obj, indent = 2) {
    let cache = [];
    const retVal = JSON.stringify(
        obj,
        (key, value) =>
            typeof value === "object" && value !== null
                ? cache.includes(value)
                    ? undefined // Duplicate reference found, discard key
                    : cache.push(value) && value // Store value in our collection
                : value,
        indent
    );
    cache = null;
    return retVal;
}

function isEmpty(object) {
    return Object.keys(object).length === 0;
}

function isObject(a) {
    return (!!a) && (a.constructor === Object);
}

function formatMessage(info, console = false) {
    let error = `${info.level}: ${isObject(info.message) ? JSONSafeStringify(info.message) : info.message}` +
        (typeof info.name !== 'undefined' ? `\nName: ${info.name}` : '');

    if (!info.error?.response) {
        // TODO it seems we only get this from ServiceLayerClient and not other axios errors, find out why
        error += (typeof info.stack !== 'undefined' ? `\n${info.stack}` : '') +
            (typeof info.response !== 'undefined' ? `\nResponse: ${formatResponse(info.response)}` : '');
    } else {
        error += (typeof info.error.config !== 'undefined' ? `\nRequest: ${formatRequest(info.error.config)}` : '') +
            (typeof info.error.response !== 'undefined' ? `\nResponse: ${formatResponse(info.error.response)}` : '');
    }

    if (!console) {
        error += (typeof info.data !== 'undefined' ? `\nData: ${JSONSafeStringify(info.data)}` : '') +
            (typeof info.url !== 'undefined' ? `\n${info.method} ${info.url}` : '') +
            (info?.body && !isEmpty(info.body) ? `\nBody: ${JSONSafeStringify(info.body)}` : '') +
            (info?.headers && !isEmpty(info.headers) ? `\nHeaders: ${JSONSafeStringify(info.headers)}` : '') +
            (info?.arguments && !isEmpty(info.arguments) ? `\nArguments: ${JSONSafeStringify(info.arguments)}` : '') +
            (info?.userId ? `\nUserId: ${info.userId}` : '');
    } else {
        error += (typeof info.data !== 'undefined' ? `\nData: ${JSONSafeStringify(info.data)}` : '');
    }

    return error;
}

function formatResponse(response, asJsonString = true) {
    if (asJsonString) {
        return JSONSafeStringify({
            data: response.data,
            status: response.status,
            statusText: response.statusText,
            // If we know the configuration we might not need this
            //headers: response.headers,
            config: {
                url: response.config.url,
                method: response.config.method,
                data: response.config.data,
            },
        });
    } else {
        return {
            data: response.data,
            status: response.status,
            statusText: response.statusText,
            // If we know the configuration we might not need this
            //headers: response.headers,
            config: {
                url: response.config.url,
                method: response.config.method,
                data: response.config.data,
            },
        };
    }
}

function formatRequest(request) {
    return JSONSafeStringify({
        url: request.url,
        method: request.method,
        data: request.data,
    }, null, 2);
}

export default {
    configure: (config, app = null) => {
        if (config.LOGS_ENABLE_CONSOLE || config.LOGS_ENABLE_CLOUDWATCH) {
            winston.configure({
                format: winston.format.combine(
                    winston.format((info, opts) => {
                        info.level = info.level.charAt(0).toUpperCase() + info.level.slice(1);
                        return info;
                    })(),
                    winston.format.colorize(),
                    winston.format.timestamp(),
                    winston.format.errors({stack: true}),
                    winston.format.json(),
                ),
                exitOnError: false,
            });

            winston.clear();

            if (config.LOGS_ENABLE_CONSOLE) {
                winston.add(new winston.transports.Console({
                    format: winston.format.combine(
                        winston.format.printf(info => {
                            return formatMessage(info, true);
                        })
                    ),
                    handleExceptions: true,
                    handleRejections: true,
                    exitOnError: false,
                }));
            }

            if (config.LOGS_ENABLE_CLOUDWATCH) {
                winston.add(new WinstonCloudwatch({
                    cloudWatchLogs: new AWS.CloudWatchLogs({
                        accessKeyId: config.LOGS_CLOUDWATCH_ACCESS_KEY_ID,
                        secretAccessKey: config.LOGS_CLOUDWATCH_SECRET_ACCESS_KEY,
                        region: config.LOGS_CLOUDWATCH_REGION,
                    }),
                    logGroupName: config.LOGS_CLOUDWATCH_LOG_GROUP_NAME,
                    logStreamName: config.LOGS_CLOUDWATCH_LOG_STREAM_NAME,
                    messageFormatter: function (info) {
                        return formatMessage(info);
                    },
                    handleExceptions: true,
                    handleRejections: true,
                    exitOnError: false,
                }));
            }
        }

        if (config.LOGS_ENABLE_SENTRY) {
            global.process.on('uncaughtException', (error) => {
            });

            const sentryOptions = {
                release: config.LOGS_SENTRY_RELEASE,
                environment: config.APP_ENV === 'DEV'
                    ? 'development'
                    : (
                        config.APP_ENV.includes('ALPHA')
                            ? 'alpha'
                            : (config.APP_ENV === 'BETA' ? 'beta' : 'production')
                    ),
                dsn: config.LOGS_SENTRY_DSN,
                tracesSampler: (samplingContext) => {
                    if (config.APP_ENV !== 'LIVE') {
                        return 0;
                    }

                    if (samplingContext?.transactionContext?.name === 'GET /entry') {
                        return 0;
                    }

                    return 0.1;
                },
                profilesSampleRate: 0, // Profiling sample rate is relative to tracesSampleRate
                integrations: integrations => {
                    const newIntegrations = integrations.filter(integration =>
                        integration.name !== 'OnUncaughtException' &&
                        integration.name !== 'Http' &&
                        integration.name !== 'LocalVariables'
                    );

                    newIntegrations.push(
                        //new ProfilingIntegration(),
                        new Sentry.Integrations.OnUncaughtException({exitEvenIfOtherHandlersAreRegistered: false}),
                        new Sentry.Integrations.Http({tracing: true}),
                        new Sentry.Integrations.LocalVariables({
                            captureAllExceptions: true,
                        }),
                        //new Dedupe(),
                    );

                    if (app) {
                        newIntegrations.push(
                            // enable Express.js middleware tracing
                            new Tracing.Integrations.Express({app}),
                        );
                    }

                    return newIntegrations;
                },
                beforeSend: function(event, hint) {
                    const error = hint.originalException || hint.syntheticException;
                    const syntheticException = hint.syntheticException;

                    if ((error.joi && error.joi.isJoi) || error.name === 'RequestError') {
                        // Errors we don't care about
                        return null;
                    }

                    const extra = {
                        stack: typeof error.stack !== 'undefined'
                            ? error.stack
                            : (syntheticException ? syntheticException.stack : null),
                    };

                    extra.request = typeof error.config !== 'undefined' ? formatRequest(error.config, false) : null;
                    extra.response = typeof error.response !== 'undefined' ? formatResponse(error.response, false) : null;
                    extra.data = typeof error.data !== 'undefined' ? error.data : null;
                    extra.url = typeof error.url !== 'undefined' ? `${error.method} ${error.url}` : null;
                    extra.body = error?.body && !isEmpty(error.body) ? error.body : null;
                    extra.headers = error?.headers && !isEmpty(error.headers) ? error.headers : null;
                    //extra.arguments = error?.arguments && !isEmpty(error.arguments) ? JSONSafeStringify(error.arguments) : '';
                    extra.userId = error?.userId ? error.userId : null;

                    event.extra = {...extra, ...event.extra};

                    if (event.request) {
                        event.fingerprint = [
                            '{{ default }}',
                            event.request.url,
                        ];
                    }

                    return event;
                }
            };

            Sentry.init(sentryOptions);
        }
    },
    log: (message, meta) => {
        _log(message, meta);
    },
    error: (message, meta) => {
        _log(message, meta);
    },
}

function _log(message, meta) {
    if (message instanceof Error) {
        if (config.LOGS_ENABLE_SENTRY) {
            Sentry.captureException(message, {extra: meta});
        }

        if (config.LOGS_ENABLE_CLOUDWATCH || config.LOGS_ENABLE_CONSOLE) {
            winston.error(message, meta);
        }
    } else {
        if (config.LOGS_ENABLE_SENTRY) {
            Sentry.captureMessage(message, {extra: meta});
        }

        if (config.LOGS_ENABLE_CLOUDWATCH || config.LOGS_ENABLE_CONSOLE) {
            winston.log(message, meta);
        }
    }
}
