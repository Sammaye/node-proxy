import dotenv from 'dotenv';
import dotenvParseVariables from 'dotenv-parse-variables';

// TODO use secrets https://aws.amazon.com/blogs/compute/securing-credentials-using-aws-secrets-manager-with-aws-fargate/
const parsed = dotenv.config().parsed;
const env = dotenvParseVariables(
    ((!!parsed) && (parsed.constructor === Object)) && Object.keys(parsed).length > 0
        ? Object.assign({}, parsed, process.env)
        : process.env,
    {assignToProcessEnv: false}
);

const config = {
    APP_NAME: 'Delenta Proxy',
    APP_ENV: env.APP_ENV,

    LOGS_SENTRY_DSN: env.LOGS_SENTRY_DSN,
    LOGS_SENTRY_RELEASE: env.LOGS_SENTRY_RELEASE,
    LOGS_CLOUDWATCH_ACCESS_KEY_ID: env.LOGS_CLOUDWATCH_ACCESS_KEY_ID,
    LOGS_CLOUDWATCH_SECRET_ACCESS_KEY: env.LOGS_CLOUDWATCH_SECRET_ACCESS_KEY,
    LOGS_CLOUDWATCH_REGION: env.LOGS_CLOUDWATCH_REGION,
    LOGS_CLOUDWATCH_LOG_GROUP_NAME: env.LOGS_CLOUDWATCH_LOG_GROUP_NAME,
    LOGS_CLOUDWATCH_LOG_STREAM_NAME: env.LOGS_CLOUDWATCH_LOG_STREAM_NAME,
    LOGS_ENABLE_CLOUDWATCH: env.LOGS_ENABLE_CLOUDWATCH,
    LOGS_ENABLE_CONSOLE: env.LOGS_ENABLE_CONSOLE,
    LOGS_ENABLE_SENTRY: env.LOGS_ENABLE_SENTRY,

    MONGO_URL: env.MONGO_URL,

    PROXY_URL: env.PROXY_URL,
}
global.config = config;
export default config;
