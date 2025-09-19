const express = require("express");
const Router = express.Router();
const AuthController = require("../controllers/AuthController");


Router.post("/registerUser", AuthController.registerUser);
Router.post("/login", AuthController.login);
Router.post("/sendOtp", AuthController.sendOtp);
Router.post("/verifyOtp", AuthController.verifyOtp);
Router.post("/resetPassword", AuthController.resetPassword);

module.exports = Router;
    