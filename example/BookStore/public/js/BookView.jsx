var BookView = React.createClass({
  getInitialState: function() {
    return {
      nextAuthor : 'Brian Kernighan'
    };
  },
  addAuthor : function() {
    var that = this;
    //Here we add a new object AND set some fields on an existing object
    //We are creating a new Author and modifying a Book to include it
    this.props.objStore.add(
      {name : this.state.nextAuthor},
      'authors',
      function(newAuthor) {
        //We need to wait for the response to get the server-generated ID        
        var authors = that.props.book.authors || [];
        authors.push(newAuthor._id);
        that.props.objStore.set(
          {authors : authors},
          that.props.book._id,
          'books');

        //This is some hardcoding to make the example run
        if (that.state.nextAuthor === 'Brian Kernighan') {
          that.setState({nextAuthor : 'Dennis Ritchie'});
        }
        else {
          that.setState({nextAuthor : ''});
        }
      });
  },
  getAuthors : function() {
    this.props.objStore.fetch(this.props.book.authors, 'authors');
  },
  render : function() {
    var authors = this.props.book.authors || [];
    var populatedAuthors = _.filter(authors, function(author) {
      return _.isObject(author);
    });
    var authorRows = _.map(populatedAuthors, function(author) {
        return author.name;//TODO: make author a component
    });

    var getAuthorLink = (
      <a href="#" onClick={this.getAuthors}>
        Get Authors
      </a>);

    return (
        <div>
          {this.props.book.title || "<No Title>"}
          <br/>
          { populatedAuthors.length > 0 ? 
            authorRows :
            getAuthorLink }
          {this.state.nextAuthor !== '' ?
          (<button onClick={this.addAuthor}>
            {"Add Author: " + this.state.nextAuthor}
          </button>) :
          null}
          <br/>
        </div>
      );
  }
});

var BookListView = React.createClass({
  getInitialState : function() {
    return {
      createdBook : false
    };
  },
  addBook : function() {
    //Here we add a new element to the system
    this.props.objStore.add(
      {title : "The C Programming Language", authors : []},
      'books');

    //This is some hardcoding to make the example run
    this.setState({createdBook : true});
  },
  render : function() {
    var that = this;
    var book_views = this.props.rootData.map(function(book) {
      return (
        <BookView
          key={book._id}
          book={book}
          objStore={that.props.objStore}/>
        );
    });
    return (
      <div>
        {book_views}
        {!this.state.createdBook ? 
          (<button onClick={this.addBook}>
            Add Book
          </button>) :
          null}
      </div>
      );
  }
});