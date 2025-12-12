const express = require("express");
const Router = express.Router();
const transactionController = require("../controllers/TransactionController");
const AuthController = require("../controllers/AuthController");

Router.post("/creditAmount", transactionController.creditAmount);
Router.post("/getWalletDetails", transactionController.getWalletDetails);
Router.post("/getUserTransaction", transactionController.getUserTransaction);

module.exports = Router;
