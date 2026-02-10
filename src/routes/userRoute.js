const express = require("express");
const Router = express.Router();
const UserController = require("../controllers/UserController");

Router.post("/updateUser", UserController.updateUser);
Router.post("/getUser", UserController.getUser);
Router.post("/deleteUser", UserController.deleteUser);
Router.post("/updateProfilePic", UserController.updateProfilePic);
Router.post("/dashboardCounts", UserController.dashboardCounts);
Router.post("/pincodeUserCount", UserController.pincodeUserCount);
Router.post("/getLevelTree", UserController.getLevelTree);

module.exports = Router;
