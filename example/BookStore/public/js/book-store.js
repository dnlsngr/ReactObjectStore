var MY_REACT_OBJECT_STORE = getAppStore();

(function() {
  //Get first few books
  $.get('/books', function(books) {
    //Instantiate app store
    MY_REACT_OBJECT_STORE.resetData(
      books,
      'books',
      BookListView,
      $('#react-parent')[0]);
  });
  //Check out BookView.jsx for update operations
})();
