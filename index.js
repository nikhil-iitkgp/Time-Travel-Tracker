import express from "express";
import bodyParser from "body-parser";
import pg from "pg";

const app = express();
const port = 3000;

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "world",
  password: "124421",
  port: 5432,
});
db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set('view engine', 'ejs');

let currentUserId = 1;

async function checkVisited(userId) {
  const result = await db.query(
    "SELECT country_code FROM visited_countries WHERE user_id = $1",
    [userId]
  );
  return result.rows.map(country => country.country_code);
}

async function getCurrentUser(userId) {
  const result = await db.query("SELECT * FROM users WHERE id = $1", [userId]);
  return result.rows[0];
}

async function getAllUsers() {
  const result = await db.query("SELECT * FROM users");
  return result.rows;
}

app.get("/", async (req, res) => {
  try {
    const countries = await checkVisited(currentUserId);
    const currentUser = await getCurrentUser(currentUserId);
    const users = await getAllUsers();
    res.render("index.ejs", {
      countries: countries,
      total: countries.length,
      users: users,
      color: currentUser.color,
      error: null,
    });
  } catch (err) {
    console.log(err);
    res.status(500).send('Server Error');
  }
});

app.post("/add", async (req, res) => {
  const input = req.body["country"];

  if (!input) {
    const countries = await checkVisited(currentUserId);
    const users = await getAllUsers();
    const currentUser = await getCurrentUser(currentUserId);
    return res.render("index.ejs", {
      countries: countries,
      total: countries.length,
      users: users,
      color: currentUser.color,
      error: 'Please enter a country name.',
    });
  }

  try {
    const countryResult = await db.query(
      "SELECT country_code FROM countries WHERE LOWER(country_name) = $1",
      [input.toLowerCase()]
    );

    if (countryResult.rows.length === 0) {
      const countries = await checkVisited(currentUserId);
      const users = await getAllUsers();
      const currentUser = await getCurrentUser(currentUserId);
      return res.render("index.ejs", {
        countries: countries,
        total: countries.length,
        users: users,
        color: currentUser.color,
        error: 'Country does not exist in the database.'
      });
    }

    const countryCode = countryResult.rows[0].country_code;

    const visitedResult = await db.query(
      "SELECT * FROM visited_countries WHERE user_id = $1 AND country_code = $2",
      [currentUserId, countryCode]
    );

    if (visitedResult.rows.length > 0) {
      const countries = await checkVisited(currentUserId);
      const users = await getAllUsers();
      const currentUser = await getCurrentUser(currentUserId);
      return res.render("index.ejs", {
        countries: countries,
        total: countries.length,
        users: users,
        color: currentUser.color,
        error: 'Country already visited.'
      });
    }

    await db.query(
      "INSERT INTO visited_countries (country_code, user_id) VALUES ($1, $2)",
      [countryCode, currentUserId]
    );
    res.redirect("/");
  } catch (err) {
    console.log(err);
    res.status(500).send('Server Error');
  }
});

app.post("/user", async (req, res) => {
  if (req.body.add === "new") {
    res.render("new.ejs", { error: null });
  } else {
    currentUserId = req.body.user;
    res.redirect("/");
  }
});

app.post("/new", async (req, res) => {
  const name = req.body.name;
  const color = req.body.color;

  if (!name) {
    return res.render("new.ejs", { error: "First Enter your name" });
  }
  if (!color) {
    return res.render("new.ejs", { error: "Don't forget to select Color" });
  }

  try {
    const existingUserResult = await db.query(
      "SELECT * FROM users WHERE LOWER(name) = $1",
      [name.toLowerCase()]
    );

    if (existingUserResult.rows.length > 0) {
      return res.render("new.ejs", { error: 'User already exists.' });
    }

    const result = await db.query(
      "INSERT INTO users (name, color) VALUES($1, $2) RETURNING *;",
      [name, color]
    );

    currentUserId = result.rows[0].id;
    res.redirect("/");
  } catch (err) {
    console.log(err);
    res.status(500).send('Server Error');
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
