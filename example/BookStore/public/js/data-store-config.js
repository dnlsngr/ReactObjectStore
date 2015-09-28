
//Backbone Models
var Book = Backbone.Model.extend({
  idAttribute: '_id',
  urlRoot: '/books'
});
var Author = Backbone.Model.extend({
  idAttribute: '_id',
  urlRoot: '/authors'
});

//Backbone Collections
var Books = Backbone.Collection.extend({
  model: Book,
  url: '/books'
});
var Authors = Backbone.Collection.extend({
  model: Author,
  url: '/authors'
});

//Class Enum
var MY_OBJECT_CLASSES = {
  'books' : {
    model : Book,
    collection : Books,
    stitchers : [
      {
        objectPath : 'authors',
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

function getLazyObjectStore() {
  return new LazyObjectStore(
    MY_OBJECT_CLASSES
  );
}