const express = require("express");
const Router = express.Router();
const businessController = require("../controllers/BusinessController");

Router.post("/addBusiness", businessController.addBusiness);
Router.post("/getBusiness", businessController.getBusiness);

module.exports = Router;
