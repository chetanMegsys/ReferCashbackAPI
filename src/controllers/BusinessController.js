const businessModel = require("../models/businessModel");
const fs = require("fs");
const path = require("path");

const addBusiness = async (req, res) => {
  try {
    const { id, lat, long, categories, ...restData } = req.body;

    const formattedCategories = Array.isArray(categories)
      ? categories
      : categories
      ? [categories]
      : [];

    // ✅ Use simple object format for location
    const location = {
      type: "Point",
      coordinates: [Number(long), Number(lat)],
    };

    if (!id) {
      if (!location) {
        return res
          .status(400)
          .send({ msg: "Latitude and Longitude are required", data: null });
      }

      const newBusiness = await businessModel.create({
        ...restData,
        categories: formattedCategories,
        location,
      });

      return res.status(200).send({
        msg: "Business added successfully",
        data: newBusiness,
      });
    }

    // For update
    const updateData = {
      ...restData,
      categories: formattedCategories,
    };

    if (location) updateData.location = location;

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

    return res.status(200).send({
      msg: "Business updated successfully",
      data: updatedBusiness,
    });
  } catch (error) {
    console.error("Error in addBusiness:", error);
    return res.status(500).send({ msg: error.message });
  }
};

const getBusiness = async (req, res) => {
  const { id, searchText, categories, lat, long } = req.body;

  if (!id || id === "") {
    try {
      let filter = {};

      // Filter by categories
      if (categories && categories.length > 0) {
        filter.categories = { $in: categories };
      }

      // Filter by search text
      if (searchText && searchText.trim() !== "") {
        const regex = new RegExp(searchText, "i"); // case-insensitive
        filter.$or = [{ businessName: regex }, { address: regex }];
      }

      // Filter by location only if lat and long are provided
      if (lat && long) {
        filter.location = {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: [Number(long), Number(lat)],
            },
            $maxDistance: 25000, // 10 km in meters
          },
        };
      }

      // Fetch businesses
      const businessData = await businessModel
        .find(filter)
        .populate("categories");

      if (!businessData || businessData.length === 0) {
        return res.status(200).send({ msg: "No businesses found", data: [] });
      }

      return res
        .status(200)
        .send({ msg: "Businesses fetched successfully", data: businessData });
    } catch (error) {
      return res.status(400).send({ msg: error.message });
    }
  } else {
    // Fetch by specific ID
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
        .send({ msg: "Business fetched successfully", data: businessData });
    } catch (error) {
      return res.status(400).send({ msg: error.message });
    }
  }
};

// const getBusiness = async (req, res) => {
//   const { id, searchText, categories } = req.body;
//   if (!id || id === "") {
//     try {
//       let filter = {};

//       if (categories && categories.length > 0) {
//         filter.categories = { $in: categories };
//       }

//       if (searchText && searchText.trim() !== "") {
//         const regex = new RegExp(searchText, "i"); // case-insensitive
//         filter.$or = [{ businessName: regex }, { address: regex }];
//       }

//       const businessData = await businessModel
//         .find(filter)
//         .populate("categories");
//       if (!businessData) {
//         return res
//           .status(400)
//           .send({ msg: " Error while fetching Business", data: null });
//       }
//       return res
//         .status(200)
//         .send({ msg: "Business fetched sucessfully", data: businessData });
//     } catch (error) {
//       return res.status(400).send({ msg: error.message });
//     }
//   } else {
//     try {
//       const businessData = await businessModel
//         .findById(id)
//         .populate("categories");
//       if (!businessData) {
//         return res
//           .status(400)
//           .send({ msg: "Error while fetching Business", data: null });
//       }
//       return res
//         .status(200)
//         .send({ msg: "Business fetched sucessfully", data: businessData });
//     } catch (error) {
//       return res.status(400).send({ msg: error.message });
//     }
//   }
// };

module.exports = { addBusiness: addBusiness, getBusiness: getBusiness };
