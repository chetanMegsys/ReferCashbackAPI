const categoryModel = require("../models/categoriesModel");

const addCategory = async (req, res) => {
  try {
    const category = await categoryModel.create(req.body);
    if (!category) {
      return res
        .status(400)
        .send({ msg: "adding category failed", data: null });
    }
    return res
      .status(200)
      .send({ msg: "Category Added Sucessfully", data: category });
  } catch (error) {
    return res.status(500).send({ msg: error.message });
  }
};

const getCategory = async (req, res) => {
  const { id } = req.body;

  if (!id || id === "") {
    try {
      const getCategoryData = await categoryModel.find();
      if (!getCategoryData) {
        return res.status(400).send({ msg: "Get Category Failed", data: null });
      }
      return res
        .status(200)
        .send({ msg: "Category Fetched SucessFully", data: getCategoryData });
    } catch (error) {
      return res.status(500).send({ msg: error.message });
    }
  } else {
    try {
      const categoryData = await categoryModel.findById(id);
      if (!categoryData) {
        return res
          .status(400)
          .send({ msg: "No such category present", data: null });
      }
      return res
        .status(200)
        .send({ msg: "Category Data fetched sucessfully", data: categoryData });
    } catch (error) {
      return res.status(500).send({ msg: error.message });
    }
  }
};

module.exports = {
  addCategory: addCategory,
  getCategory: getCategory,
};
