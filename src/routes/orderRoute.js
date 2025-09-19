const express = require("express");
const Router = express.Router();
const orderController = require("../controllers/OrderController");

Router.post("/getWalletDetails", orderController.getWalletDetails);
Router.post("/createOrder", orderController.createOrder);
Router.post("/getOrders", orderController.getOrders);
Router.post("/acceptOrRejectOrder", orderController.acceptOrRejectOrder);
Router.post("/cancelOrder", orderController.cancelOrder);
Router.post("/getOrdersByMonth", orderController.getOrdersByMonth);

module.exports = Router;
