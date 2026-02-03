const express = require("express");
const Router = express.Router();

const categoryController = require("../controllers/categoryController");
Router.post("/addUpdateCategory", categoryController.addUpdateCategory);
Router.post("/getCategory", categoryController.getCategory);
Router.post("/deleteCategory", categoryController.deleteCategory);

module.exports = Router;
