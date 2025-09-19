const dotenv = require("dotenv");
const app = require("./app");
const mongoose = require("mongoose");
dotenv.config();

console.log("Environment Variables Loaded:");

const DB = process.env.DATABASE_URL;

console.log("DATABASE_URL:", DB);
// const options = {
//   reconnectTries: Number.MAX_VALUE,
//   poolSize: 10,
// };

// mongoose.connect(process.env.DATABASE_URL, options).then(
//   () => {
//     console.log("Database connection established!...");
//   },
//   (err) => {
//     console.log("Error connecting Database instance due to: ", err);
//   }
// );
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
