const { paginateArray } = require("../CommanFuntion/Pagination");
const categoryModel = require("../models/categoriesModel");

// const addCategory = async (req, res) => {
//   try {
//     const { _id, name, minDiscount } = req.body;
//     const category = await categoryModel.create(req.body);
//     if (!category) {
//       return res
//         .status(400)
//         .send({ msg: "adding category failed", data: null });
//     }
//     return res
//       .status(200)
//       .send({ msg: "Category Added Sucessfully", data: category });
//   } catch (error) {
//     return res.status(500).send({ msg: error.message });
//   }
// };
const addUpdateCategory = async (req, res) => {
  try {
    const { id, name, minDiscount } = req.body;

    let category;

    if (id) {
      // 🔁 UPDATE
      category = await categoryModel.findByIdAndUpdate(
        id,
        { name, minDiscount },
        { new: true, runValidators: true },
      );

      if (!category) {
        return res.status(404).send({ msg: "Category not found", data: null });
      }

      return res
        .status(200)
        .send({ msg: "Category Updated Successfully", data: category });
    } else {
      // ➕ ADD
      category = await categoryModel.create({
        name,
        minDiscount,
      });

      return res
        .status(201)
        .send({ msg: "Category Added Successfully", data: category });
    }
  } catch (error) {
    return res.status(500).send({ msg: error.message });
  }
};

const getCategory = async (req, res) => {
  const { id, pageNumber, pageLimit, isPagination, searchText } = req.body;
  if (!id || id === "") {
    try {
      const getCategoryData = await categoryModel.find({ status: "active" });
      if (!getCategoryData) {
        return res.status(400).send({ msg: "Get Category Failed", data: null });
      }
      const paginated = paginateArray({
        data: getCategoryData,
        page: pageNumber,
        limit: pageLimit,
        isPagination: isPagination,
        search: searchText,
        searchKeys: ["name"],
      });
      return res
        .status(200)
        .send({ msg: "Category Fetched SucessFully", data: paginated });
    } catch (error) {
      return res.status(500).send({ msg: error.message });
    }
  } else {
    try {
      const categoryData = await categoryModel.findOne({
        _id: id,
        status: "active",
      });
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

const deleteCategory = async (req, res) => {
  try {
    const { id } = req.body;
    if (!id || id === "") {
      return res.status(400).send({ msg: "Please enter id" });
    }

    const deleteCategoryData = await categoryModel.findOneAndUpdate(
      { _id: id, status: "active" },
      { $set: { status: "inactive" } },
      { new: true },
    );
    if (!deleteCategoryData) {
      return res
        .status(400)
        .send({ msg: "No such category present", data: null });
    }

    return res.status(200).send({ msg: "Category deleted successfully" });
  } catch (error) {
    return res.status(500).send({ msg: error.message });
  }
};

module.exports = {
  addUpdateCategory: addUpdateCategory,
  getCategory: getCategory,
  deleteCategory,
};
