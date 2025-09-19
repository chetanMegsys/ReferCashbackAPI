const express = require("express");
const Router = express.Router();
const transactionController = require("../controllers/TransactionController");

Router.post("/creditAmount", transactionController.creditAmount);
Router.post("/getWalletDetails", transactionController.getWalletDetails);

module.exports = Router;
