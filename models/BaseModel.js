import mongoose from 'mongoose';
/**
 * @type {mongoose.Model}
 */
const model = null;

export default class BaseModel {
    static model = model;

    constructor(data) {
        return new this.constructor.model(data);
    }

    static aggregate(pipeline, callback) {
        return this.model.aggregate(pipeline, callback);
    }

    static bulkSave(documents, options, callback) {
        return this.model.bulkWrite(documents, options, callback);
    }

    static bulkWrite(ops, options, callback) {
        return this.model.bulkWrite(ops, options, callback);
    }

    static count(filter, callback) {
        return this.model.count(filter, callback);
    }

    static countDocuments(filter, callback) {
        return this.model.countDocuments(filter, callback);
    }

    static estimatedDocumentCount(options, callback) {
        return this.model.estimatedDocumentCount(options, callback);
    }

    static create(docs, options, callback) {
        return this.model.create.apply(this.model, arguments);
    }

    static deleteMany(conditions, options, callback) {
        return this.model.deleteMany(conditions, options, callback);
    }

    static deleteOne(conditions, options, callback) {
        return this.model.deleteOne(conditions, options, callback);
    }

    static distinct(name, schema, options) {
        return this.model.distinct(name, schema, options);
    }

    static exists(filter, options, callback) {
        return this.model.exists(filter, options, callback);
    }

    static find(filter, projection, options, callback) {
        return this.model.find(filter, projection, options, callback);
    }

    static findById(id, projection, options, callback) {
        return this.model.findById(id, projection, options, callback);
    }

    static findByIdAndDelete(id, options, callback) {
        return this.model.findByIdAndDelete(id, options, callback);
    }

    static findByIdAndRemove(id, options, callback) {
        return this.model.findByIdAndRemove(id, options, callback);
    }

    static findByIdAndUpdate(id, update, options, callback) {
        return this.model.findByIdAndUpdate(id, update, options, callback);
    }

    static findOne(conditions, projection, options, callback) {
        return this.model.findOne(conditions, projection, options, callback);
    }

    static findOneAndDelete(conditions, options, callback) {
        return this.model.findOneAndDelete(conditions, options, callback);
    }

    static findOneAndRemove(conditions, options, callback) {
        return this.model.findOneAndRemove(conditions, options, callback);
    }

    static findOneAndReplace(filter, replacement, options, callback) {
        return this.model.findOneAndReplace(filter, replacement, options, callback);
    }

    static findOneAndUpdate(conditions, update, options, callback) {
        return this.model.findOneAndUpdate(conditions, update, options, callback);
    }

    static where(path, val) {
        return this.model.where(path, val);
    }

    static insertMany(docs, options, callback) {
        return this.model.insertMany(docs, options, callback);
    }

    static mapReduce(o, callback) {
        return this.model.mapReduce(o, callback);
    }

    static populate(docs, options, callback) {
        return this.model.populate(docs, options, callback);
    }

    static remove(conditions, options, callback) {
        return this.model.remove(conditions, options, callback);
    }

    static replaceOne(filter, docs, options, callback) {
        return this.model.replaceOne(filter, docs, options, callback);
    }

    static startSession(options, callback) {
        return this.model.startSession(options, callback);
    }

    static update(filter, doc, options, callback) {
        return this.model.update(filter, doc, options, callback);
    }

    static updateMany(filter, update, options, callback) {
        return this.model.updateMany(filter, update, options, callback);
    }

    static updateOne(filter, update, options, callback) {
        return this.model.updateOne(filter, update, options, callback);
    }

    static validate(obj, pathsToValidate, context, callback) {
        return this.model.validate(obj, pathsToValidate, context, callback);
    }

    static watch(pipeline, options) {
        return this.model.watch(pipeline, options);
    }
}
