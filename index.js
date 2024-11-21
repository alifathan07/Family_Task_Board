import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt";
import session from 'express-session';
import multer from "multer";
import fs from 'fs';
import path from "path";
import { fileURLToPath } from 'url';
import flash from 'connect-flash';

const app = express();
const port = 3000;
const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); // get the name of the directory
const folderPath = path.join(__dirname, "public/uploads/images");
if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, folderPath);
  },
  filename: function (req, file, cb) {
    // Generate a unique filename while keeping the original extension
    const extname = path.extname(file.originalname).toLowerCase();
    console.log(extname)
    const validExtensions = ['.jpeg', '.png','.jpg'];

    // If the file extension is valid, proceed to save it with a unique name
    if (validExtensions.includes(extname)) {
      cb(null, Date.now() + extname); // Adding a unique timestamp to the file name
    } else {
      cb(new Error('Invalid file type'), false); // Reject the file if it's not a valid type
    }
  }
});
const upload = multer({
  storage: storage,
  fileFilter: storage[0]
});


const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "todolist",
  password: "root",
  port: 5000,
});
db.connect();
app.use(flash());
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
 else{
  next();
 } // User is not logged in, proceed to the login route
 const log = req.session.user
};

const date = new Date();
const saltRounds = 10;
function hasingpass(str) {

  return bcrypt.hashSync(str, saltRounds);
}
app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  next();
});


app.get("/register", isLoggedIn,(req,res) => {
  res.render("register.ejs",{ user: req.session.user});
})

// pass users to Headers.ejs


async function hashingpass(pass){
  const saltRounds = 10;
  return bcrypt.hash(pass, saltRounds);
}
app.post("/submit/register", upload.single("file"), async (req, res) => {
  try {
    const image = req.file;
    if (!image) {
      return res.status(400).send("No file uploaded.");
    }

    console.log(image.filename);  // Logs the original name of the uploaded file
    const name = req.body.name;
    const email = req.body.email;
    const password = req.body.password;

    // تأكد من تشفير كلمة المرور قبل حفظ البيانات
    const hashedpassword = await hashingpass(password);
    console.log(hashedpassword);

    // Save file path to the database (imagepath will store the file's name or relative path)
    const adduser = await db.query("INSERT INTO users (name, email, password, imagepath) VALUES($1, $2, $3, $4)", [name, email, hashedpassword, image.filename]);
    if (adduser) {
      req.flash('info', 'You have successfully registered. Now you can log in.') // Display success message after registration
      res.redirect('/login');
    

    }
  } catch (error) {
    console.log(error.message);
    res.status(500).send("Server error.");
  }
});

app.get("/login", isLoggedIn,(req,res) => {
  res.render("login.ejs", {messages: req.flash()})// Always pass flash messages})
});



app.post("/submit/login", async(req, res) =>  {
  const email = req.body.email;
  const password = req.body.password;
  const user = await db.query("SELECT * FROM users WHERE email = $1",[email]);
  const hashedpass = user.rows[0].password;
  const isMatch = await bcrypt.compare(password, hashedpass)
  if(isMatch){
    req.session.user = user.rows[0].id;
    req.flash('success', 'Welcome to your account ' + user.rows[0].name)
    res.redirect("/");
  }else{
    res.send("Invalid credentials");
  }
});
app.get("/", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM items WHERE user_id = $1", [req.session.user]);
    const listItems = result.rows; // Extract the rows from the result
    const data = await db.query("SELECT * FROM users WHERE id = $1", [req.session.user]);
    const users = data.rows[0];

    res.render("index.ejs", {
      listTitle: new Date().getDate() + "/" + (new Date().getMonth() + 1) + "/" + new Date().getFullYear(),
      listItems,
      check: req.session.user,
      messages: req.flash(), // Always pass flash messages
      users: users || null // Pass user data or null
    });
  } catch (error) {
    console.error("Error fetching items:", error);
    res.status(500).send("Internal Server Error");
  }
});


app.post("/add", async(req, res) => {
  try {
    const item = req.body.newItem;
    await db.query("INSERT INTO items (title,user_id) VALUES ($1,$2)", [item,req.session.user])
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
app.get('/logout', (req, res) => {
  req.session.destroy((err) => {  // Flash a success message when the user logs out
    if (err) {
      return res.status(500).send('Failed to logout');
    }
    
    res.redirect('/');  // Redirect to the home page after logout
  });
});
app.get('/profile/:id', async(req, res) => {
  const profile = await db.query("SELECT * FROM users WHERE id = $1 ",  [req.params.id]);
  res.render("profile.ejs", { user: req.session.user, profile: profile.rows[0] });
});

app.post("/delete", async(req, res) => {
  const id = req.body.deleteItemId;
  await db.query("DELETE FROM items WHERE id = $1", [id])
  res.redirect("/");
});






















app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
