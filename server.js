const dotenv = require("dotenv");
const app = require("./app");
const mongoose = require("mongoose");
dotenv.config();


const DB = process.env.DATABASE_URL;

mongoose
  .connect(DB)
  .then(() => {
    console.log("Database connection established!...");
  })
  .catch((err) => {
    console.error("Error connecting Database instance due to: ", err);
  });

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`App running on port ${port}`);
});
