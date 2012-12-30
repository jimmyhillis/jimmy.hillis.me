/**
 * Module dependencies.
 */

var express = require('express')
  , mongoose = require('mongoose')
  // routes
  , routes = require('./routes')
  , posts = require('./routes/posts')
  , feeds = require('./routes/feeds')
  , path = require('path')
  , passport = require('passport');

// Build express application

var app = module.exports = express();

// Server configation

app.configure(function() {
    app.set('port', process.env.PORT || 3000);
    app.use(express.bodyParser());
    app.use(express.methodOverride());

    // User JADE for markup template lang
    app.set('view engine', 'jade');
    app.set('views', path.join(__dirname, 'views'));

    app.use(express.logger('dev'));

    app.use(express.cookieParser());
    app.use(express.session({ secret: 'testing secret man' }));
    app.use(passport.initialize());
    app.use(passport.session());

    var static = path.join(__dirname, 'public');
    app.use(express.static(static));
});

app.configure('development', function() {
    console.log('-- DEVELOPMENT SERVER');
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function() {
    app.use(express.errorHandler());
});

// Database connection

mongoose.connect('mongodb://localhost/jimmy-hillis-me', function(err) {
    if (err) {
        console.log('Failed to connect to MongoDB');
    }
});

// Model definitions

mongoose.model(
    'pages',
    new mongoose.Schema({
       'name': String,
       'title': String,
       'copy': String,
       'order': Number
    }));

mongoose.model(
    'posts',
    new mongoose.Schema({
        'name': String,
        'title': String,
        'posted': { 'type': Date, 'default': Date.now },
        'copy': String
    }));

mongoose.model(
    'users',
    new mongoose.Schema({
        'username': String,
        'email': String,
        'password': String
    }));

User = mongoose.model('users');
User.prototype.validPassword = function (password) {
    if (this.password === password) {
        return true;
    }
};

app.set('db', mongoose);

// Configure authentication with passport

var LocalStrategy = require('passport-local').Strategy;

passport.use(new LocalStrategy(
  function(username, password, done) {
    User.findOne({ username: username }, function (err, user) {
        if (err) {
            return done(err);
        }
        if (!user) {
            return done(null, false, { message: 'Incorrect username.' });
        }
        if (!user.validPassword(password)) {
            return done(null, false, { message: 'Incorrect password.' });
        }
        return done(null, user);
    });
  }
));

passport.serializeUser(function(user, done) {
    done(null, user.id);
});

passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
        done(err, user);
    });
});

// Template helper methods

app.locals.markdown = function (text) {
    var md = require("node-markdown").Markdown;
    return md(text);
};

app.locals.dateformat = function(date, format) {
    var moment = require('moment');
    format = format || "dddd, MMMM Do YYYY";
    return moment(date).format(format);
};

app.use(function(req, res, next){
    res.locals.user = req.user;
    res.locals.current_url = 'http://' + req.header('host') + req.url;
    next();
});

// Routes

routes = routes(app);
app.get('/', routes.index);
app.get('/lab', routes.lab);
app.get('/music', routes.music);
app.get('/contact', routes.contact);

// Authentication

var auth = {
    'login': function (req, res) {
        res.render('login', {
            'page_title': 'Login'
        });
    },
    'cms': function (req, res, next) {
        if (!req.isAuthenticated()) {
            res.redirect('/login');
        }
        return next();
    }
};

app.get('/login', auth.login);
app.post('/login',
    passport.authenticate('local', {
        successRedirect: '/post/',
        failureRedirect: '/login'
    }));

// Blog routes

posts = posts(app);
app.get('/post.:format?', auth.cms, posts.list);
app.post('/post.:format?', auth.cms, posts.create);
app.get('/post/new', auth.cms, posts.add);
app.get('/post/:id.:format?', posts.read);
app.get('/post/:id/edit.:format?', auth.cms, posts.edit);
app.del('/post/:id.:format?', auth.cms, posts.remove);
app.put('/post.:format?', auth.cms, posts.update);

// 404 error page

app.use(function(req,res) {
	res.render('404', { 'title': 'Page Not Found' });
});

// Run server app

var running = app.listen(app.get('port'), function () {
    console.log("Express server listening on port " + app.get('port'));
});
