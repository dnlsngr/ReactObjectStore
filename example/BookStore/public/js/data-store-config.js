
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
    collection : Books
  },
  'authors' : {
    model : Author,
    collection : Authors
  },
};

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
  function stitchAuthor(author) {
    //No dependent objects right now
  }

  function stitchBooks(books) {
    _.each(books, stitchBook);
  }
  function stitchAuthors(authors) {
    _.each(authors, stitchAuthor);
  }


  switch (rootParentType){
    case 'books':
      stitchBooks(rootData);
      break;
    case 'authors':
      stitchAuthors(rootData);
      break;
    default:
      throw new Error('Stitching with invalid parent type');
  }

  return rootData;
}

function getAppStore() {
  return new AppStore(
    stitch,
    MY_OBJECT_CLASSES
  );
}