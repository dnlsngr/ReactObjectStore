var LazyObjectStore = function(classEnum, copyFunction){
    if (!classEnum) {
        throw new Error('Must provide object schema!');
    }
    _.values(classEnum, function(config) {
        if (!config.model || !config.collection) {
            throw new Error('All data types must have a model and a collection');
        }
    });
    //Validation: make sure each stitcher has an object path
    this.MODEL_CLASSES = classEnum;
};

//TODO: make this configurable by the user
function getCopy(obj) {
    return JSON.parse( JSON.stringify( obj ) );
}

function _populate(refElem, path, modelType) {
    // IMPORTANT: lets you pass in which field on the element has the id
    // e.g. for deal.properties, id is deal.properties[x].property_id
    // e.f. for contact.phones, the id is just contact.phones[x]
    var object_id = path ? refElem[path] : refElem;

    //Ref may already be populated
    var objId = _.isObject(object_id) ? object_id._id : object_id;
    var refObj = this._modelHash[modelType].get(objId);

    // Push the object if we have it--otherwise push id back
    var newObj = refObj ? refObj.toJSON() : objId;
    if (!_.isObject(newObj)) {
        //Unable to populate
        return refElem;
    }
    else {
        newObj = getCopy(newObj);
    }
    // Recursively stitch if necessary
    if (this.MODEL_CLASSES[modelType].stitchers) {
        _findStitch.call(this, newObj, modelType);
    }
    if (path) {
        refElem[path] = newObj;
    }
    return refElem;
}

//Only used internally (should be private)
function _findStitch(data, modelName) {
    var stitchers = this.MODEL_CLASSES[modelName].stitchers;
    if (!stitchers) {
        return;
    }

    var that = this;
    _.each(stitchers, function(stitcher) {
        _.each(data, function(parentObject) {
            var objRef = parentObject[stitcher.objectPath];
            if (_.isArray(objRef)) {
                var stitchedRefs = _.map(objRef, function(objToStitch) {
                    return _populate.call(that,
                        objToStitch, 
                        stitcher.idPath,
                        stitcher.modelType);
                });
                parentObject[stitcher.objectPath] = stitchedRefs;
            }
            else {
                var stitchedRef = _populate.call(that,
                        objRef, 
                        stitcher.idPath,
                        stitcher.modelType);
                parentObject[stitcher.objectPath] = stitchedRef;
            }
        });
    });
    return data;
}

//Only used internally (should be private)
function _getStitchedDataFromModelHash(){
    var that = this;
    //Grab the root elements from the collection
    var rootData = _.map(that._rootIds, function(id){
        var model = that._modelHash[that._rootParentType].get(id);
        var rootElem = model ? model.toJSON() : id;
        return rootElem;
    });

    //Copy so as to not operate on the objects in the data store
    var rootDataCopy = getCopy(rootData);

    //Stitch the data together based on the types. Update data store
    return _findStitch.call(this, rootDataCopy, this._rootParentType);

}

LazyObjectStore.prototype.resetData = function(topLevelData,
                                            rootParentType,
                                            rootParentReactClass,
                                            rootParentNode,
                                            additionalProps)
{
    if (topLevelData && rootParentNode && rootParentReactClass){
        // topLevelData is an array of root objects or ids
        this._rootIds = _.map(topLevelData, function(elem){
            return _.isString(elem) ? elem : elem._id;
        });

        this._rootParentType = rootParentType;

        this._fetchCache = {}; //Objects we are in the process of getting from server
        this._fetchedAll = {}; //Models for which we've fetched all from the server

        //Instantiate empty stores for all models
        this._modelHash = _.mapObject(this.MODEL_CLASSES, function(val, key) {
            var collectionClass = val.collection;
            return new collectionClass();
        });
        //Prepopulate one store with passed-in top-level data (ignoring data passed in as strings)
        var rootObjects = _.reject(topLevelData, function(elem) {
            return _.isString(elem);
        });
        var rootCollectionClass = this.MODEL_CLASSES[rootParentType].collection;
        this._modelHash[rootParentType] = new rootCollectionClass(rootObjects);

        //Fetch data from models (picking up any modifications made in the model)
        var stitchedTopLevelData = _getStitchedDataFromModelHash.call(this);

        this._dataObj = {
            rootData: stitchedTopLevelData, //This gets reset on rerender
            objStore: this,
        };
        additionalProps = additionalProps || {};
        _.extend(this._dataObj, additionalProps);

        var rootElement = 
            React.createElement(
                rootParentReactClass, 
                this._dataObj, 
                rootParentNode
            );
        this._rootDescriptor = React.render(rootElement, rootParentNode);
    }
    else {
        throw new Error('Store reset with invalid inputs');
    }
};

LazyObjectStore.prototype.renderRoot = function(thisUpdate)
{
    //If we are going to pull more data from the server, we have already
    //rendered that change: don't rerender here, the data is stale
    if (thisUpdate && thisUpdate !== this._lastUpdateSent){
        return;
    }

    this._dataObj.rootData = _getStitchedDataFromModelHash.call(this);

    this._rootDescriptor.setProps(this._dataObj);
};

LazyObjectStore.prototype.add = function(object, modelName, callback)
{
    var newModelClass = this.MODEL_CLASSES[modelName].model;
    var newModel = new newModelClass(object);

    var thisUpdate = (new Date()).getTime();
    this._lastUpdateSent = thisUpdate;

    var that = this;
    newModel.save(object, { 
        wait: true,
        success: function(model) {
            that._modelHash[modelName].add(model);
            if (modelName === that._rootParentType){
                that._rootIds.push(newModel.id);
            }
            that.renderRoot(thisUpdate);
            if (callback){
                callback(model.toJSON());
            }
        }, 
        error: function(err, arg2) {
            if (callback){
                callback(null);
            }
        }
    });
}

LazyObjectStore.prototype.destroy = function(id, modelName, callback)
{
    var collection = this._modelHash[modelName];
    if (!collection){
        throw new Error("Missing collection to destroy " +  modelName);
    }
    var model = collection.get(id);
    if (!model){
        throw new Error("Missing model to destroy " +  modelName + " " + id);
    }

    var that = this;
    model.destroy({ 
        wait: true,
        success: function(model, response) {
            collection.remove( model );
            if (callback){
                callback();
            }
        }
    });
}

LazyObjectStore.prototype.set = function(field, newValue, id, modelName, callback)
{
    if (_.isObject(field)){
        //support update object as well as field/newValue
        callback = modelName;
        modelName = id;
        id = newValue;

        var updateObj = field;
    }
    else{
        var updateObj = {};
        updateObj[field] = newValue;
    }

    var collection = this._modelHash[modelName];
    if (!collection){
        throw new Error("Missing collection to set " +  modelName);
    }
    var model = collection.get(id);
    if (!model){
        throw new Error("Missing model to set " +  modelName + " " + id);
    }

    var thisUpdate = (new Date()).getTime();
    this._lastUpdateSent = thisUpdate;

    var that = this;
    model.save(updateObj,{
        wait: true,
        success: function(newModel){
            that._modelHash[modelName].set(id, newModel.toJSON());
            that.renderRoot(thisUpdate);
            if (callback){
                callback(model.toJSON());
            }
        },
        failure: function(e){throw new Error("SAVE FAILED " + e)}
    });
    //render here to update ASAP
    model.set(field, newValue);
    this.renderRoot();

};

LazyObjectStore.prototype.fetch = function(ids, modelName)
{
    if (!_.isArray(ids)){
        ids = [ids];
    }
    var objsToFetch = [];
    var that = this;
    _.each(ids, function(id){
        if (!_.isString(id) || that._fetchCache[id]){
            return;
        }
        var obj = that._modelHash[modelName].get(id);
        if (!obj){
            objsToFetch.push(id);
        }
    });

    if (objsToFetch.length !== 0){
        _.each(objsToFetch, function(id){
            that._fetchCache[id] = true;
        })
        var idString = objsToFetch.join(',');
        var endpoint = (new this.MODEL_CLASSES[modelName].model()).url();
        $.get(endpoint+'/' + idString, function(res){
            if (_.isArray(res) === false){
                res = [res];
            }

            _.each(res, function(obj){
                that._modelHash[modelName].add(obj);
                delete that._fetchCache[obj._id];//clean up cache as we go
            });
            that.renderRoot();
        });
    }
};

LazyObjectStore.prototype.fetchAll = function(modelName, callback)
{
    if (this._fetchedAll[modelName] === true){
        //We've already fetched all these
        return;
    }
    if (this._fetchCache[modelName] === true){
        //Already in progress fetching this
        return;
    }

    this._fetchCache[modelName] = true;
    var that = this;
    var endpoint = this.MODEL_CLASSES[modelName].model.url;
    $.get(endpoint, function(res){
        if (_.isArray(res) === false){
            res = [res];
        }

        that._fetchCache[modelName] = false;
        that._fetchedAll[modelName] = true;//No need to fetch all again

        _.each(res, function(obj){
            if ( !(that._modelHash[modelName].get(obj._id)) ){
                //Found a new object we didn't have
                that._modelHash[modelName].add(obj);
            }
        });
        that.renderRoot();
        if (callback) {
            callback();
        }
    });
};

LazyObjectStore.prototype.refresh = function(id, modelName, callback)
{
    var model = this._modelHash[modelName].get(id);
    if (!model){
        throw new Error('On refresh we missed ' + modelName + ' ' + id);
    }

    var thisUpdate = (new Date()).getTime();
    this._lastUpdateSent = thisUpdate;

    var that = this;
    model.fetch({
        wait: true,
        success: function(respCollection, respObj){
            that.renderRoot(thisUpdate);
            if (callback) {
                callback();
            }
        }
    });
};

//NOTE: this is meant for use from the top level and does not refresh the tree
LazyObjectStore.prototype.setCollection = function(collection, modelName)
{
    var existingCollection = this._modelHash[modelName];
    if (existingCollection && existingCollection.length > 0){
        throw new Error("Trying to set a collection that already exists");
        return;
    }

    this._modelHash[modelName] = collection;
}
