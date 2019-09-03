const express = require("express");
const app = express();
const exphbs = require('express-handlebars');
const mongoose = require('mongoose');
const bodyParser = require("body-parser");
const methodOverride = require('method-override');
const session = require("express-session");
const flash = require("connect-flash");
const path = require("path");
const bcrypt = require("bcryptjs");
const passport = require("passport");
const {ensureAuthenticated} = require("./helpers/auth");

const pass = 'T5313WVbzLxHj2eI';


// override with POST having ?_method=DELETE
app.use(methodOverride('_method'));

//Load Routes
//const users=require("./routes/users");

//Load Passport Config
require("./config/passport")(passport);

// Load Model for NEWUSER
require("./models/Users");
const User = mongoose.model("users");


//Middlware for express-session order 1
app.use(session({
    secret: 'secret',
    resave: true,
    saveUninitialized: true,

}));


// Order  2 
app.use(passport.initialize());
app.use(passport.session());
// middlware For Flash
app.use(flash());


//Global Variable
app.use((req, res, next) => {
    res.locals.success_msg = req.flash("success_msg");
    res.locals.error_msg = req.flash("error_msg");
    res.locals.error = req.flash("error");
    res.locals.user= req.user || null ;
    next();
});

//Map Promise
mongoose.Promise = global.Promise;
//MiddleWar for body-parser
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Mongoose Connection
mongoose.connect('mongodb+srv://Memo:' + pass + '@cluster0-cgy3o.mongodb.net/test?retryWrites=true&w=majority', {

    useNewUrlParser: true
}).then(() => {
    console.log('MnogoDB Connected');
}).catch((err) => {
    console.log(err);
});

//Load IdeaModel
require("./models/Ideas");
const Idea = mongoose.model("ideas");

//port number
const port = process.env.PORT || 5000;
// handlebars-middleware
app.engine('handlebars', exphbs());
app.set('view engine', 'handlebars');


// Routes
app.get('/', (req, res) => {
    var title = "Welcome";
    res.render("index", {
        title: title
    });
});
app.get('/about', (req, res) => {
    res.render('about');
});
// Add Idea Form
app.get('/ideas/add',ensureAuthenticated, (req, res) => {

    res.render("ideas/add");
});
// Process Form
app.post('/ideas',ensureAuthenticated, (req, res) => {
    let erorrs = [];
    if (!req.body.title) {
        erorrs.push({
            text: "Please Add A Title"
        });
    }
    if (!req.body.details) {
        erorrs.push({
            text: "Please Add Some Details"
        });
    }
    if (erorrs.length > 0) {
        res.render("ideas/add", {
            erorrs: erorrs,
            title: req.body.title,
            details: req.body.details
        })
    } else {
        const NewUser = {
            title: req.body.title,
            details: req.body.details,
            user: req.user.id
        }
        new Idea(NewUser)
            .save().then(Idea => {
                req.flash("success_msg", "Video Idea Adedd");
                res.redirect("/ideas");
            });
    }
});

app.get('/ideas',ensureAuthenticated, (req, res) => {
    Idea.find({user: req.user.id})
        .sort({ date: 'desc' })
        .then(ideas => {
            res.render("ideas/index", {
                ideas: ideas
            });
        })
});

app.get('/ideas/edit/:id',ensureAuthenticated, (req, res) => {
    Idea.findOne({
        _id: req.params.id
    }).then(idea => {
        if(idea.user != req.user.id){
            req.flash("error_msg","You Are not allowed to do this shit");
            res.redirect("/ideas");
        }else{
        res.render("ideas/edit", {
            idea: idea
        });
    }
    });

});
//Edit Form process
app.put('/ideas/:id',ensureAuthenticated, (req, res) => {
    Idea.findOne({
        _id: req.params.id
    }).then(idea => {
        idea.title = req.body.title;
        idea.details = req.body.details;
        idea.save().then(idea => {
            req.flash("success_msg", "Video Idea Updated");
            res.redirect("/ideas")
        });
    });

});
app.delete('/ideas/:id',ensureAuthenticated, (req, res) => {
    Idea.remove({ _id: req.params.id })
        .then(() => {
            req.flash("success_msg", "Video Idea Removed");
            res.redirect("/ideas");
        });

});
//Use Routes
// app.use(app.route);
// const users= require("./routes/users");
// app.get('/users', app.routes.users);
//Staic Path
app.use(express.static(path.join(__dirname, 'public')));

////
app.get('/users/login', (req, res) => {
    res.render("users/login");
});
// Login Post

app.post('/users/login', (req, res, next) => {
    passport.authenticate('local', {
        successRedirect: "/ideas",
        failureRedirect: "/users/login",
        failureFlash: true

    })(req, res, next);
});



//
app.get('/users/logout', (req, res) => {
    req.logout();
    req.flash("success_msg","Logged out successfully")
    res.redirect("/");
});

//
app.get('/users/register', (req, res) => {
    res.render("users/register");
});
//
app.post('/users/register', (req, res) => {
    let erros = [];
    if (req.body.password != req.body.password2) {
        erros.push({ text: "Passwords don't Match" });
    }
    if (req.body.password < 8) {
        erros.push({ text: "Password must be At least 8 characters" });
    }
    if (erros.length > 0) {
        res.render("users/register", {
            erros: erros,
            name: req.body.name,
            email: req.body.email,
            password: req.body.password,
            password2: req.body.password2
        });
    } else {
        User.findOne({ email: req.body.email })
            .then(user => {
                if (user) {
                    req.flash("error_msg", "Email already registerd");
                    res.redirect("/users/register");

                } else {
                    const newUser = {
                        name: req.body.name,
                        email: req.body.email,
                        password: req.body.password,
                    };


                    bcrypt.genSalt(10, (err, salt) => {
                        //
                        bcrypt.hash(req.body.password, salt, (err, hash) => {
                            if (err) throw err;
                            newUser.password = hash;
                            new User(newUser).save()
                                .then(user => {
                                    req.flash("success_msg", "You are Now Registerd and Can Login");
                                    res.redirect("/users/login");
                                })
                                .catch(err => {
                                    console.log(err);
                                    return;
                                });

                        });
                    });

                }
            });
    }
});

app.listen(port, () => {
    console.log(`App Listing to port ${port}`);
});

