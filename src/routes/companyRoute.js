const express = require("express");
const companyController = require("../controllers/companyController");
const Router = express.Router();

Router.post("/getCompanyDetails", companyController.getCompanyDetails);

module.exports = Router;
