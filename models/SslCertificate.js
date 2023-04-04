import mongoose, { Schema } from 'mongoose';
import moment from 'moment';

import BaseModel from './BaseModel';

const schema = new Schema({
    userId: {
        type: mongoose.SchemaTypes.ObjectId,
        required: true,
        ref: 'User',
    },
    token: {
        type: String,
    },
    key: {
        type: String,
    },
    domain: {
        type: String,
    },
    csr: {
        type: String,
    },
    private_key: {
        type: String,
    },
    certificate: {
        type: String,
    },
    expiresAt: {
        type: Date,
    },
    renewsAt: {
        type: Date
    },
    isVerified: {
        type: Boolean,
        default: false
    }
}, { collection: 'ssl_certificates', timestamps: true });

const model = mongoose.model('SslCertificate', schema);

export default class extends BaseModel {
    static model = model;
}
