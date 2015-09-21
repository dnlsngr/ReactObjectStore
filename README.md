# ReactObjectStore
React Lazy Object Store allows you to build complex client-heavy applications in React, while making lazy-loading and updating data simple to implement and reason about. It is ideal for applications which are backed by a complex hierarchy of data objects that can be loaded independently.

##Notes on usage
* Data should be hierarchical, with subtypes related to their parents at a predictable object path. For example, a Book object that contains an `authors` field with an array of Author references.
* References from a parent object to a child should be specified as object IDs in place of the object, as implemented by [Mongoose 'ref' types](http://mongoosejs.com/docs/populate.html)
* Top-level data for your site should be represented as an array of one or more objects of the same type. For example, an array of Book objects would make sense as top-level data, with references to Author objects that can be loaded at a later time.

##Notes on design

####Initialization and use

The top-level API is meant to be used outside a React component, to initialize the Object Store and to pass top-level data into the React tree. **The React App Store will pass two properties into the parent component: `rootData` which is an array of top-level objects, and `objStore`, which is a reference to the Object Store itself, and should allow access to the update API by passing the objStore property as a prop down the tree.**

####Storing and Stitching

The guiding principal of the React Lazy Object Store is that objects are easiest to work with and update in isolation, while their composed hierarchy is only relevant to view the data.

All data objects are stored in isolation, in separate Backbone collections by type. Only just before we want to render the UI do we stitch the individual objects together according to a stitching function provided in the configuration.

For example, we might have a Book object, which has a reference to an Author object, as follows:

```
//Book
{
  _id     : '538f255864d771bf0bd9dddd',
  title   : 'The C Programming Language',
  authors : [
    '538f255864d771bf0bd91111',
    '538f255864d771bf0bd93333'
  ]
}

//Author
{
  _id   : '538f255864d771bf0bd91111',
  name  : 'Brian Kernighan'
}

```

The Object Store will keep two separate collections of Book and Author models. Just before it renders, it will call a user-supplied stitch function, which might look something like this:

```javascript
function stitchBook(book) {
  book.authors  = _.map(book.authors, function(authorId) {
    if (_.isString(authorId)) {
      //If object is not populated, look for it in the hash
      var refObj = that._modelHash['authors'].get(authorId);
      //If we have it, plug it into the right place in the object
      if (refObj) {
        var refObjCopy = JSON.parse(JSON.stringify(refObj));
        stitchAuthor(refObjCopy);
        return refObjCopy;
      }
    }
    //If obj is populated, or if we don't have it, just put the id back
    return authorId;
  });
}
```

#### Fetching

The decision to load a piece of data into the UI is always driven by some user interaction which signals that the data is needed. Therefore, the React Lazy Object Store provides a single command for a React component to load a piece of data, which does the following:

1. Ensures that we don't have the data in the Store already
2. Makes a call to a special `get()` endpoint that fetches objects for a list of IDs
3. Adds the resulting objects to the data store in the client
4. Re-stitches and re-renders the UI, which will now have the new data

Note that this informs the design of the stitcher: it should always try to attach objects that are present in the client data store, but if not, it leaves them as references, which can be fetched by the React components at a later time as needed.

#Quickstart:

##1. Set up REST endpoints for your objects

The object store assumes you have REST endpoints that support CRUD operations, in exactly the way Backbone is normally configured. You can see their [documentation](http://backbonejs.org/) for more details. Please note that for `fetch()` to work, an additional `get()` endpoint needs to be configured to return multiple ids at once. For example:

```javascript
app.post('/authors', function (req, res) {
  var author = req.body;
  //create author
  res.send(author);
});
app.get('/authors', function (req, res) {
  //retrieve authors
  res.send(authors);
});
app.get('/authors/:id', function (req, res) {
  //retrieve author
  res.send(author);
});
app.put('/authors/:id', function (req, res) {
  var newFields = req.body;
  //retrieve author and update with new fields
  res.send(newAuthor);
});
//Special fetch for multiple ids
app.get('/authors/fetch/:ids', function (req, res) {
  var ids = req.params.ids.split(',');
  //retrieve all authors in list of ids
  res.send(authors);
});
```

##2. Install Backbone

See site for details: http://backbonejs.org/

##3. Define Backbone models and collections (to be used in our React Lazy Object Store)

The models we will use inside the Object Store are passed in by the user to allow for full configuration. For example:

```javascript
var Book = Backbone.Model.extend({
  idAttribute: '_id',
  urlRoot: '/books'
});
var Books = Backbone.Collection.extend({
  model: Book,
  url: '/books'
});
```

##4. Define stitching function

This is a function that is called on every re-render, and executes the stitching together of disparate objects. Its input is a set of top-level objects in the hierarchy. For each object, it should look for the element of interest, and then on a best-effort-basis try to swap in the actual object from the model hash. Make sure you read the above notes on Storing and Stitching to understand how this should work. Here is an example stitch function:

```javascript
//Stitching Function
var stitch = function(rootData, rootParentType) {
  var that = this;

  function stitchBook(book) {
    book.authors  = _.map(book.authors, function(authorId) {
      if (_.isString(authorId)) {
        //If object is not populated, look for it in the hash
        var refObj = that._modelHash['authors'].get(authorId);
        //If we have it, plug it into the right place in the object
        if (refObj) {
          var refObjCopy = JSON.parse(JSON.stringify(refObj));
          stitchAuthor(refObjCopy);
          return refObjCopy;
        }
      }
      //If obj is populated, or if we don't have it, just put the id back
      return authorId;
    });
  }

  function stitchBooks(books) {
    _.each(books, stitchBook);
  }


  switch (rootParentType){
    case 'books':
      stitchBooks(rootData);
      break;
    case 'authors':
      //no dependent objects
      break;
    default:
      throw new Error('Stitching with invalid parent type');
  }

  return rootData;
}
```

##5. Instantiate Object Store

Each object store will be represented as one tree attached to one DOM node. If you have a single react tree for all data, you can maintain a single store, or you can create a separate one to handle separate data objects. Note that instantiation only applies to configuration, and that you'll need to call `ResetData` to load the initial data into the tree.

#Top-level API

These functions are called from outside your React components, and are used to initalize the Object Store and the data inside it.

##Constructor

```javascript
var ObjStore = function(stitch, classEnum){...
```

See above for notes on designing a `stitch()` function.

The classEnum is a configuration for the data types that will be stored, and the Backbone classes that will be used to store them.

```javascript
var Book = Backbone.Model.extend({
  idAttribute: '_id',
  urlRoot: '/books'
});
var Books = Backbone.Collection.extend({
  model: Book,
  url: '/books'
});
...

var CLASS_ENUM = {
  'books' : {
    model : Book,
    collection : Books
  },
  'authors' : {
    model : Author,
    collection : Authors
  },
};
```

##ResetData

```javascript
function resetData(topLevelData, rootParentType, rootParentReactClass, rootParentNode) {...
```

This is used to instantiate a react tree with a given data array on a given DOM node, with a specified parent class. It is expected to be called from the top-level, outside the tree of React components.

```javascript
ObjStore.resetData(
  books,        //data: array of top-level objects
  'books',      //model name: configured at instantiation
  BookListView,
  $('#react-parent')[0]);

```

##Set Collection

```javascript
function setCollection(collection, modelName) {...
```

This is used to override the contents of an un-initialized collection. This can be useful in cases where you don't want to lazy-load datasets that are not at the top-level of your hierarchy. For example, you may have a list of authors in memory when you load a list of books, and so after initializing the React Lazy Object Store with Books, you can call `ObjStore.setCollection(authors, 'authors');`.

#Update API

These functions are called from within React components, *by accessing the `objStore` prop that is passed into the top-level component.* All of these functions trigger a re-render of the UI.

##Add

```javascript
function add(object, modelName, [callback]) {...
```

This is used to create a new object, add it to the data store, and persist it to the server (via Backbone sync).

```
var BookView = React.createClass({
  ...
  addAuthor : function(authorName) {
    this.props.objStore.add(
      {name : authorName},
      'authors');
  },
  ...
});
```

##Set

```javascript
function set(field, newValue, id, modelName, [callback]) {...
```
```javascript
function set(updateObject, id, modelName, [callback]) {...
```

This is used to update a field on an existing object in the data store, and persist it to the server (via Backbone sync). Fields can also be updated in bulk by replacing the first two arguments with an object containing the new field values.

```
var BookView = React.createClass({
  ...
  updateTitle : function(newTitle) {
    var book = this.props.book;
    this.props.objStore.set('title', newTitle, book._id, 'books');
  },
  ...
});
```

##Destroy

```javascript
function destroy(id, modelName, [callback]) {...
```

This is used to delete an object from the data store, and delete it from the server (via Backbone)

```
var BookView = React.createClass({
  ...
  deleteAuthor : function(authorId) {
    this.props.objStore.destroy(book._id, 'books');
  },
  ...
});
```

##Fetch

```javascript
function fetch(ids, modelName) {...
```

This is how your application can lazy-load data, and should be called from within the React views when an action is taken that necessitates additional objects to be loaded. Since this will automatically trigger a re-render when the data returns, the stitching function should automatically swap the new data in its correct place. Note that fetching an object that already exists in the Object Store will have no effect; if you need to explicitly update an object with data from the server, use `refresh`.

For example, when a user toggles open a Book view, we might want to load the Author objects ahead of time in case the user wants to view the authors:

```
var BookView = React.createClass({
  ...
  toggleVisible : function() {
    var authorIds = this.props.book.authors;
    this.props.objStore.fetch(authorIds);
    this.setState({viewExpanded : true});
  },
  ...
});
```

##FetchAll

```javascript
function fetchAll(modelName, [callback]) {...
```

A convenience function that requests all objects of the given type from the server. Useful for populating multi-selects, and other cases where all elements should be displayed to the user. Any subsequent calls to this function will result in no action. 

##Refresh

```javascript
function refresh(id, modelName, [callback]) {...
```

Use this function to retrieve data for an object from the server and overwrite the current object stored in the Object Store, if it exists. This is useful when your application triggers a server-side process that updates data objects without returning the updated representations to your React component.

For example, a book store might provide a button to check competitors' prices, and cache them on the book object. The server would go examine competitors sites, save the results to the database, and then return to the client. 

```
var BookView = React.createClass({
  ...
  checkCompetitors : function() {
    var that = this;
    var bookId = this.props.book.bookId;
    $.get('/check-competitors?book=' + bookId,
      function done() {
        that.props.objStore.refresh(bookId, 'books');
      });
  },
  ...
});
```
