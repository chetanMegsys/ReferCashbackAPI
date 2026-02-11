const express = require("express");
const Router = express.Router();

const paymentmethodController = require("../controllers/PaymentMethodController");

Router.post("/addPaymentMethod", paymentmethodController.addPaymentMethod);
Router.get("/getPaymentMethods", paymentmethodController.getPaymentMethods);

module.exports = Router;
