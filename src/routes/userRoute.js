const express = require("express");
const Router = express.Router();
const UserController = require("../controllers/UserController");

Router.post("/updateUser", UserController.updateUser);
Router.post("/getUser", UserController.getUser);

module.exports = Router;
