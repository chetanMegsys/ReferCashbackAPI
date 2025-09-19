const express = require("express");
// const morgan = require("morgan");
const bodyParser = require("body-parser");
const fileUpload = require("express-fileupload");
const cors = require("cors"); // Add CORS
const app = express();
const authRoute = require("./src/routes/authRoute");
const userRoute = require("./src/routes/userRoute");
const businessRoute = require("./src/routes/businessRoute");
const orderRoute = require("./src/routes/orderRoute");
const transactionRoute = require("./src/routes/transactionRoute");
const categoryRoute = require("./src/routes/categoryRoute");

const auth = require("./src/controllers/AuthController");

// Enable CORS for all routes
app.use(cors());
// app.use("/uploads", express.static("public/uploads"));
// app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(fileUpload());

app.use(express.static("./public"));

app.use("/auth", authRoute);
app.use("/user", userRoute);
app.use("/business", businessRoute);
app.use("/order", orderRoute);
app.use("/transaction", transactionRoute);
app.use("/category", categoryRoute);

app.use(express.urlencoded({ extended: true }));

// Handle 404 errors
// app.all("*", (req, resp, next) => {
//   resp.status(404).json({
//     status: "fail",
//     message: `Can't find ${req.originalUrl} on this server!`,
//   });
// });

module.exports = app;
