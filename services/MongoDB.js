/**
 * @file Proxy class for handle mongoDB functionality.
 * @author Hasitha Gamage
 */

const _ = require('lodash');
const mongoose = require('mongoose');

export default {
    async connect(config) {
        const {
            MONGO_URL: mongoUrl = null,
            MONGO_HOST: host,
            MONGO_PORT: port,
            MONGO_DB_NAME: dbName,
            MONGO_DB_USER: dbUser = null,
            MONGO_DB_PASS: dbPassword = null
        } = config;

        let mongoDBUrl;
        let authPrefix = '';
        let authSuffix = '';

        if (!_.isNull(dbUser) && !_.isNull(dbPassword)) {
            authPrefix = `${dbUser}:${dbPassword}@`;
            authSuffix = '?authSource=admin';
        }

        if (_.isEmpty(mongoUrl) || _.isNull(mongoUrl)) {
            mongoDBUrl = `mongodb://${authPrefix}${host}:${port}/${dbName}${authSuffix}`;
        } else {
            mongoDBUrl = mongoUrl;
        }

        if (
            mongoose.connection.readyState &&
            mongoose.connection._connectionString !== mongoDBUrl
        ) {
            // If connecting to different database than config then disconnect
            await mongoose.disconnect();
        }

        if (mongoose.connection.readyState) {
            // else if connected/connecting leave it alone
            return true;
        }

        await mongoose.connect(
            mongoDBUrl,
            {
                useNewUrlParser: true,
                useCreateIndex: true,
                useFindAndModify: false,
                useUnifiedTopology: true,
                serverSelectionTimeoutMS: 5000 // Keep trying to send operations for 5 seconds, 
            },
            error => {
                if (error) {
                    throw error;
                }
                console.log('Connected to MongoDB | Ready for use.');
            }
        );
    }
};
