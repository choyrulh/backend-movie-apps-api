const mongoose = require("mongoose");
const dotenv = require("dotenv");
const app = require("./app");

dotenv.config({ path: "./.env" });

const DB = process.env.DATABASE.replace(
  "<PASSWORD>",
  process.env.DATABASE_PASSWORD
);

mongoose
  .connect(DB, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    dbName: "MovieApps", // specify the database name
  })
  .then(() => console.log("DB connection successful!"))
  .catch((err) => console.error(err));

const port = process.env.PORT || 3100;
app.listen(port, () =>
  console.log(`this express app listening on port ${port}!`)
);
