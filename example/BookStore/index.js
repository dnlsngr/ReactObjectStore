var _ = require('underscore');
var express = require('express');
var app = express();

app.use('/static', express.static(__dirname + '/public'));

//Entry point
app.get('/', function (req, res) {
  res.sendFile(__dirname + '/public/index.html');
});

//MOCK DATA STORE
var BOOKS = [
  {
    _id     : 'BOOKID_1',
    title   : 'Javascript: The Good Parts',
    authors : ['AUTHORID_1']
  }
];
var AUTHORS = [
  {
    _id     : 'AUTHORID_1',
    name    : 'Douglas Crockford'
  }
];

//CRU(D) for Books
app.post('/books', function (req, res) {
  var book = req.body;
  var bookNum = BOOKS.length;
  book = _.extend(book, {
    _id : 'BOOKID_' + bookNum
  });
  BOOKS.push(book);

  res.send(book);
});
app.get('/books', function (req, res) {
  res.send(BOOKS);
});
app.get('/books/:id', function (req, res) {
  var id = req.params.id;
  //TODO: handle ID miss
  res.send(_.findWhere(BOOKS, {_id: id}));
});
//Special fetch for multiple ids
app.get('/books/fetch/:ids', function (req, res) {
  var ids = req.params.ids.split(',');
  //TODO: handle ID miss and bad id formatting
  res.send(_.filter(BOOKS, function(book) {
    return _.contains(ids, book._id)
  }));
});
app.put('/books/:id', function (req, res) {
  var newFields = req.body;
  var bookId = newFields._id;
  //TODO: validation if ID missing
  var bookToUpdate = _.findwhere(BOOKS, {_id: bookId});
  var newBook = _.extend(bookToUpdate, newFields);
  BOOKS = _.map(BOOKS, function(book) {
    return book._id === newBook._id ?
      newBook :
      book;
  });

  res.send(newBook);
});

//CRU(D) for Authors
app.post('/authors', function (req, res) {
  console.log('body',req.body);
  var author = req.body;
  var authorNum = AUTHORS.length;
  author = _.extend(author, {
    _id : 'AUTHORID_' + authorNum
  });
  AUTHORS.push(author);
  console.log('author', author);
  res.send(author);
});
app.get('/authors', function (req, res) {
  res.send(AUTHORS);
});
app.get('/authors/:id', function (req, res) {
  var id = req.params.id;
  //TODO: handle ID miss
  res.send(_.findWhere(AUTHORS, {_id: id}));
});
//Special fetch for multiple ids
app.get('/authors/fetch/:ids', function (req, res) {
  var ids = req.params.ids.split(',');
  //TODO: handle ID miss and bad id formatting
  res.send(_.filter(AUTHORS, function(author) {
    return _.contains(ids, author._id)
  }));
});
app.put('/authors/:id', function (req, res) {
  var newFields = req.body;
  var authorId = newFields._id;
  //TODO: validation if ID missing
  var authorToUpdate = _.findwhere(AUTHORS, {_id: authorId});
  var newAuthor = _.extend(authorToUpdate, newFields);
  AUTHORS = _.map(AUTHORS, function(author) {
    return newAuthor._id === newAuthor._id ?
      newAuthor :
      author;
  });

  res.send(newAuthor);
});

//Run server
var server = app.listen(3000, function () {
  var host = server.address().address;
  var port = server.address().port;

  console.log('Book store listening at http://%s:%s', host, port);
});