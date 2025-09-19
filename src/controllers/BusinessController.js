const businessModel = require("../models/businessModel");
const fs = require("fs");
const path = require("path");

const addBusiness = async (req, res) => {
  const { id, lat, long, categories, ...restData } = req.body;
  const formattedCategories = [].concat(categories || []);

  let location = null;
  if (lat && long) {
    location = {
      type: "Point",
      coordinates: [parseFloat(long), parseFloat(lat)],
    };
  }

  if (!id || id === "") {
    try {
      const newBusiness = await businessModel.create({
        ...restData,
        categories: formattedCategories,
        ...(location && { location }),
        ...(lat && { lat: parseFloat(lat) }),
        ...(long && { long: parseFloat(long) }),
      });

      if (!newBusiness) {
        return res
          .status(400)
          .send({ msg: "Error while adding business", data: null });
      }
      return res.status(200).send({
        msg: "Business added successfully",
        data: newBusiness,
      });
    } catch (error) {
      return res.status(500).send({ msg: error.message });
    }
  } else {
    try {
      const updateData = {
        ...restData,

        categories: formattedCategories,
      };

      if (lat && long) {
        updateData.lat = parseFloat(lat);
        updateData.long = parseFloat(long);
        updateData.location = {
          type: "Point",
          coordinates: [parseFloat(long), parseFloat(lat)],
        };
      }
      const updatedBusiness = await businessModel.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true }
      );

      if (!updatedBusiness) {
        return res
          .status(400)
          .send({ msg: "Business failed to update", data: null });
      }
      return res
        .status(200)
        .send({ msg: "Business Updated sucessfully", data: updatedBusiness });
    } catch (error) {
      return res.status(500).send({ msg: error.message });
    }
  }
};

const getBusiness = async (req, res) => {
  const { id, searchText, categories } = req.body;
  if (!id || id === "") {
    try {
      let filter = {};

      if (categories && categories.length > 0) {
        filter.categories = { $in: categories };
      }

      if (searchText && searchText.trim() !== "") {
        const regex = new RegExp(searchText, "i"); // case-insensitive
        filter.$or = [{ businessName: regex }, { address: regex }];
      }

      const businessData = await businessModel
        .find(filter)
        .populate("categories");
      if (!businessData) {
        return res
          .status(400)
          .send({ msg: " Error while fetching Business", data: null });
      }
      return res
        .status(200)
        .send({ msg: "Business fetched sucessfully", data: businessData });
    } catch (error) {
      return res.status(400).send({ msg: error.message });
    }
  } else {
    try {
      const businessData = await businessModel
        .findById(id)
        .populate("categories");
      if (!businessData) {
        return res
          .status(400)
          .send({ msg: "Error while fetching Business", data: null });
      }
      return res
        .status(200)
        .send({ msg: "Business fetched sucessfully", data: businessData });
    } catch (error) {
      return res.status(400).send({ msg: error.message });
    }
  }
};

module.exports = { addBusiness: addBusiness, getBusiness: getBusiness };
