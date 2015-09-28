# ReactObjectStore
React Lazy Object Store allows you to build complex client-heavy applications in React, while making lazy-loading and updating data simple to implement and reason about. It is ideal for applications which are backed by a complex hierarchy of data objects that can be loaded independently.

##Notes on usage
* Data should be hierarchical, with subtypes related to their parents at a predictable object path. For example, a `Book` object that contains an `authors` field with an array of `Author` references.
* References from a parent object to a child should be specified as object IDs in place of the object, as implemented by [Mongoose 'ref' types](http://mongoosejs.com/docs/populate.html)
* Top-level data for your site should be represented as an array of one or more objects of the same type. For example, an array of `Book` objects would make sense as top-level data, with references to `Author` objects that can be loaded at a later time.

##Notes on design

####Initialization and use

The "top-level" API (`resetData` and `setCollection`) is meant to be used outside a React component, to initialize the Object Store and to pass top-level data into the React tree. The remaining methods constitute the "update" API, and should be called from inside the React tree.

**The React App Store will pass two properties into the parent component: `rootData` which is an array of top-level objects, and `objStore`, which is a reference to the Object Store itself, and should allow access to the "update" API as a prop, which can be passed around to child components that need to `set`, `add`, `destroy`, `fetch` or `refresh` data objects.**

####Storing and Stitching

The guiding principal of the React Lazy Object Store is that objects are easiest to work with in isolation, while their composed hierarchy is only relevant to view the data.

All data objects are stored in isolation, in separate Backbone collections by type. Only just before we want to render the UI do we stitch the individual objects together.

For example, we might have a Book object, which has a reference to an Author object, as follows:

```
//Book
{
  _id     : '538f255864d771bf0bd9dddd',
  title   : 'The C Programming Language',
  author_list : [
    { author_id : '538f255864d771bf0bd91111'},
    { author_id : '538f255864d771bf0bd93333'}
  ]
}

//Author
{
  _id   : '538f255864d771bf0bd91111',
  author_name  : 'Brian Kernighan'
}

```

The Object Store will keep two separate collections of Book and Author models, but if a Book has a reference to an Author that has been lazy-loaded ('fetched'), then that author will appear in place of its `author_id` on the Book object when passed into your React component.

#### Fetching

The decision to load a piece of data into the UI from the server is always driven by some user interaction which signals that the data is needed. Therefore, the React Lazy Object Store provides a single command for a React component to load a piece of data, which does the following:

1. Ensures that we don't have the data in the Store already, and that we're not in the process of fetching it
2. Makes a call to a special `get()` endpoint that fetches objects for a list of IDs
3. Adds the resulting objects to the data store in the client
4. Re-stitches and re-renders the UI, which will now have the new data

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

##4. Build `classEnum` configuration object

The configuration object needs to contain a Model and Collection for each datatype, as well as an array of `stitchers` which define the relationship to any child objects. In this example, our Book objects have an array of Author objects that need to be populated, so the enum would have a stithcer as follows:

```
var CLASS_ENUM = {
  'books' : {
    model : Book,
    collection : Books,
    stitchers : [
      {
        objectPath : 'author_list',
        idPath : 'author_id',
        modelType: 'authors'
      }
    ]
  },
  'authors' : {
    model : Author,
    collection : Authors
  },
};
```

##5. Instantiate Object Store

Each object store will be represented as one tree attached to one DOM node so you can create a separate store to handle separate data objects that live in separate trees. Note that instantiation only configures the Object Store, and that you'll need to call `ResetData()` to load the initial data into the tree.

```
var myObjectStore = new LazyObjectStore(CLASS_ENUM);
```

##6. Reset Data

Finally, load some data into the store, and tell it what React class to use to display the data, and which DOM node should be the parent.
```javascript
ObjStore.resetData(
  books,        //data: array of top-level objects
  'books',      //model name: field name in CLASS_ENUM corresponding to the object type
  BookListView, //React component that expects an array of 'book' objects in the rootData prop
  $('#react-parent')[0]);
```

#Top-level API

These functions are called from outside your React components, and are used to initalize the Object Store and the data inside it.

##Constructor

```javascript
var ObjStore = function(classEnum){...
```

The classEnum is a configuration for the data types that will be stored, and the Backbone classes that will be used to store them. It also includes a list of 'stitchers' that describe how objects relate to each other. This includes three parameters:

 * `objectPath` : The field name on the parent object where we will find the relevant stitched reference location. Note that if we have an array of reference objects, this should only reference the field that stores the array, and we can use `idPath` to reference fields inside each reference object.
 * `modelType` : The classEnum key that corresponds to the child object's type. For recursive stitching this can be the key that contains this stitcher (for example, a 'person' may have an array of 'friends' that have `modelType: 'person'`).
 * `idPath` : If a reference to a child object lives in a parent object (as in our example, which has `author_id` inside an array of objects on the Book), then this field tells the stitcher which field on contains the reference to the child. 

```
//Book
// {
//   _id     : '538f255864d771bf0bd9dddd',
//   title   : 'The C Programming Language',
//   author_list : [
//     { author_id : '538f255864d771bf0bd91111'},
//     { author_id : '538f255864d771bf0bd93333'}
//   ]
// }
```

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
    collection : Books,
    stitchers : [
      {
        objectPath : 'author_list',
        idPath : 'author_id',
        modelType: 'authors'
      }
    ]
  },
  'authors' : {
    model : Author,
    collection : Authors
  },
};
```

##Reset Data

```javascript
function resetData(topLevelData, rootParentType, rootParentReactClass, rootParentNode) {...
```

This is used to instantiate a react tree with a given data array on a given DOM node, with a specified parent class. It is expected to be called from the top-level, outside the tree of React components.

```javascript
ObjStore.resetData(
  books,        //data: array of top-level objects
  'books',      //model name: configured at instantiation
  BookListView, //React component that expects an array of 'book' objects in the rootData prop
  $('#react-parent')[0]);

```

##Set Collection

```javascript
function setCollection(collection, modelName) {...
```

This is used to override the contents of an un-initialized collection. This can be useful in cases where you don't want to lazy-load datasets that are not at the top-level of your hierarchy. For example, you may have a list of authors in memory when you load a list of books, and so after initializing the React Lazy Object Store with Books, you can call `ObjStore.setCollection(authors, 'authors');`.

#Update API

These functions are called from within React components, **by accessing the `objStore` prop that is passed into the top-level component.** All of these functions trigger a re-render of the UI.

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
      {author_name : authorName},
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

This is how your application can lazy-load data, and should be called from within the React views when an action is taken that requires additional objects to be loaded. Note that fetching an object that already exists in the Object Store will have no effect; if you need to explicitly update an object with data from the server, use `refresh`.

For example, when a user toggles open a Book view, we might want to load the Author objects ahead of time in case the user wants to view the authors:

```
var BookView = React.createClass({
  ...
  toggleVisible : function() {
    var authorIds = this.props.book.author_list;
    this.props.objStore.fetch(authorIds);
    this.setState({viewExpanded : true});
  },
  ...
});
```

##Fetch All

```javascript
function fetchAll(modelName, [callback]) {...
```

A convenience function that requests all objects of the given type from the server. Useful for populating multi-selects, and other cases where all elements in your database (of a given type) should be displayed to the user. Any subsequent calls to this function will result in no action. 

##Refresh

```javascript
function refresh(id, modelName, [callback]) {...
```

Use this function to retrieve data for an object from the server and overwrite the current object stored in the Object Store, if it exists. This is useful when your application triggers a server-side process that updates data objects without returning the updated representations to your React component.

For example, a book store might provide a button to check competitors' prices, and cache them on the book object in the database. The server would go examine competitors sites, save the results, and then return to the client. 

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
