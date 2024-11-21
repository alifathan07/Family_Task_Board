import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt";
import session from 'express-session';
import path from 'express-path';
const app = express();
const port = 3000;

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "todolist",
  password: "root",
  port: 5000,
});
db.connect();
///// Bro relation is one to many user can have a lot of tasks 
app.use(session({
  secret: 'ali', // Secret key to sign session ID cookies
  resave: false,           // Don't save session if not modified
  saveUninitialized: true, // Save new sessions even if they are not modified
  cookie: { maxAge: 60000 } // Session cookie expiration (1 minute for example)
}));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

const isLoggedIn = (req, res, next) => {
  if (req.session.user) {
      // User is logged in, redirect to home
      return res.redirect('/');
  }
  next(); // User is not logged in, proceed to the login route
};
const date = new Date();
const saltRounds = 10;
function hasingpass(str) {
  return bcrypt.hashSync(str, saltRounds);
}
async function getitems(){
  const items = await db.query("SELECT * FROM items");
  return items.rows;
}

async function users(){
  const users = await db.query("SELECT * FROM users");
  return users.rows;
}

app.get("/register", isLoggedIn,(req,res) => {
  res.render("register.ejs");
})
app.post("/submit/register", async(req,res) => {
  try {
    
    const name = req.body.name;
    const email = req.body.email;
    const hashedpassword =  hasingpass(req.body.password);
    const image = req.files.image;
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
    if (!allowedTypes.includes(image.mimetype)) {
      return res.status(400).send("Invalid file type. Only JPEG and PNG are allowed.");
    }
    const uploadPath = path.join(__dirname, "uploads", image.name);
    await image.mv(uploadPath);
    await db.query("INSERT INTO users (name, email, password,imagePath) VALUES($1, $2, $3,$4)", [name, email, hashedpassword,'/uploads/${image.name}']);

    res.redirect("/");
  } catch (error) {
    console.log(error.message);
  }
});

app.get("/login", isLoggedIn,(req,res) => {
  res.render("login.ejs")
});

app.post("/submit/login", async(req, res) =>  {
  const email = req.body.email;
  const password = req.body.password;
  const user = await db.query("SELECT * FROM users WHERE email = $1",[email]);
  const hashedpass = user.rows[0].password;
  const isMatch = await bcrypt.compare(password, hashedpass)
  if(isMatch){
    req.session.user = user.rows[0].id;
    res.send("Welcome to your Account!");
  }else{
    res.send("Invalid credentials");
  }
});
app.get("/", async(req, res) => {
  res.render("index.ejs", {
    listTitle: new Date().getDate()+ "/" + new Date().getMonth()  + "/" + new Date().getFullYear(),
    listItems:  await getitems(),
    listUsers:  await users(),
  });
});

app.post("/add", async(req, res) => {
  try {
    const item = req.body.newItem;
    await db.query("INSERT INTO items (title) VALUES ($1)", [item])
    res.redirect("/");
  }catch (error) {
    res.send(error.message);
  }
});

app.post("/edit", async(req, res) => {
  try {
    const id = req.body.updatedItemId;
    const title = req.body.updatedItemTitle;
      await db.query("UPDATE items SET title = $1 WHERE id = $2", [title, id])
      
    res.redirect("/");
  } catch (error) {
    console.log(error.message);
  }
});

app.post("/delete", async(req, res) => {
  const id = req.body.deleteItemId;
  await db.query("DELETE FROM items WHERE id = $1", [id])
  res.redirect("/");
});






















app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
