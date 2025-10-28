const express = require("express");
const Router = express.Router();
const UserController = require("../controllers/UserController");

Router.post("/updateUser", UserController.updateUser);
Router.post("/getUser", UserController.getUser);
Router.post("/updateProfilePic", UserController.updateProfilePic);

module.exports = Router;
