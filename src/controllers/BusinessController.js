const businessModel = require("../models/businessModel");
const fs = require("fs");
const path = require("path");
const user = require("../models/userModel");

const addBusiness = async (req, res) => {
  try {
    const { id, categories, ...restData } = req.body;

    const formattedCategories = Array.isArray(categories)
      ? categories
      : categories
        ? [categories]
        : [];

    // ✅ Use simple object format for location

    if (!id) {
      const newBusiness = await businessModel.create({
        ...restData,
        categories: formattedCategories,
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

    const updatedBusiness = await businessModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true },
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

// const getBusiness = async (req, res) => {
//   const { id, searchText, categories, lat, long } = req.body;

//   try {
//     let filter = {};

//     // Filter by categories
//     if (categories && categories.length > 0) {
//       filter.categories = { $in: categories };
//     }

//     // Filter by search text
//     if (searchText && searchText.trim() !== "") {
//       const regex = new RegExp(searchText, "i"); // case-insensitive
//       filter.$or = [
//         { businessName: regex },
//         { address: regex },
//         { Pincode: regex },
//       ];
//     }

//     // ✅ Filter by Pincode
//     // if (pincode && pincode.toString().trim() !== "") {
//     //   filter.Pincode = pincode.toString();
//     // }
//     // Filter by location only if lat and long are provided
//     if (lat && long) {
//       filter.location = {
//         $near: {
//           $geometry: {
//             type: "Point",
//             coordinates: [Number(long), Number(lat)],
//           },
//           $maxDistance: 25000, // 25 km radius
//         },
//       };
//     }

//     // ✅ If ID is provided — fetch that specific business
//     if (id && id !== "") {
//       const businessData = await businessModel
//         .findById(id)
//         .populate("categories")
//         .populate({
//           path: "shopkeeperId", // ✅ this matches your schema
//           model: "users", // ✅ this matches your ref
//         });

//       if (!businessData) {
//         return res.status(404).send({ msg: "Business not found", data: null });
//       }

//       return res
//         .status(200)
//         .send({ msg: "Business fetched successfully", data: businessData });
//     }

//     // ✅ Otherwise — fetch all businesses matching filters
//     const businessData = await businessModel
//       .find(filter)
//       .populate("categories")
//       .populate({
//         path: "shopkeeperId", // ✅ this matches your schema
//         model: "users", // ✅ this matches your ref
//       });

//     if (!businessData || businessData.length === 0) {
//       return res.status(200).send({ msg: "No businesses found", data: [] });
//     }

//     return res
//       .status(200)
//       .send({ msg: "Businesses fetched successfully", data: businessData });
//   } catch (error) {
//     return res.status(400).send({ msg: error.message });
//   }
// };

// const getBusiness = async (req, res) => {
//   const { id, searchText, categories, pincode } = req.body;

//   try {
//     let filter = {};

//     // ✅ Filter by categories
//     if (categories && categories.length > 0) {
//       filter.categories = { $in: categories };
//     }

//     // ✅ Filter by search text
//     if (searchText && searchText.trim() !== "") {
//       const regex = new RegExp(searchText, "i");
//       filter.$or = [
//         { businessName: regex },
//         { address: regex },
//         { Pincode: regex },
//       ];
//     }

//     // ✅ Filter by Pincode (IMPORTANT)
//     // if (pincode && pincode.toString().trim() !== "") {
//     //   const firstFour = pincode.toString().substring(0, 4);
//     //   filter.Pincode = new RegExp("^" + firstFour); // starts with first 4 digits
//     // }

//     const picodeSearchLevel = 5;
//     if (pincode && pincode.toString().trim() !== "") {
//       const pinStr = pincode.toString();

//       if (pinStr.length >= 2) {
//         const base = pinStr.slice(0, -2); // e.g. "4110"
//         const lastTwo = parseInt(pinStr.slice(-2), 10); // e.g. 33

//         const range = [];

//         for (
//           let i = lastTwo - picodeSearchLevel;
//           i <= lastTwo + picodeSearchLevel;
//           i++
//         ) {
//           if (i >= 0 && i <= 99) {
//             range.push(base + i.toString().padStart(2, "0"));
//           }
//         }

//         filter.Pincode = { $in: range };
//       }
//     }

//     // ✅ If ID is provided — fetch single business
//     if (id && id !== "") {
//       const businessData = await businessModel
//         .findById(id)
//         .populate("categories")
//         .populate("shopkeeperId");

//       if (!businessData) {
//         return res.status(404).send({ msg: "Business not found", data: null });
//       }

//       return res.status(200).send({
//         msg: "Business fetched successfully",
//         data: businessData,
//       });
//     }

//     // ✅ Fetch businesses by filters
//     const businessData = await businessModel
//       .find(filter)
//       .populate("categories")
//       .populate({
//         path: "shopkeeperId",
//         select:
//           "-password -email -createdAt -updatedAt -refreshToken -panCardNumber -aadhaarCardNumber -rationCardNumber -deviceDetails -walletDetails", // exclude these fields
//       });

//     if (!businessData.length) {
//       return res.status(200).send({
//         msg: "No businesses found",
//         data: [],
//       });
//     }

//     return res.status(200).send({
//       msg: "Businesses fetched successfully",
//       data: businessData,
//     });
//   } catch (error) {
//     return res.status(400).send({ msg: error.message });
//   }
// };
const getBusiness = async (req, res) => {
  const { id, searchText, categories, pincode } = req.body;

  try {
    let filter = {};

    let pinBase = null;
    let pinLastTwo = null;
    const picodeSearchLevel = 3;
    // ✅ Filter by categories
    if (categories && categories.length > 0) {
      filter.categories = { $in: categories };
    }

    // ✅ Filter by search text
    if (searchText && searchText.trim() !== "") {
      const regex = new RegExp(searchText, "i");
      filter.$or = [
        { businessName: regex },
        { address: regex },
        { Pincode: regex },
      ];
    }

    // ✅ Filter by nearby pincode (±5 levels)
    if (pincode && pincode.toString().trim() !== "") {
      const pinStr = pincode.toString();

      if (pinStr.length >= 2) {
        pinBase = pinStr.slice(0, -2); // e.g. "4110"
        pinLastTwo = parseInt(pinStr.slice(-2), 10); // e.g. 33

        const range = [];
        for (
          let i = pinLastTwo - picodeSearchLevel;
          i <= pinLastTwo + picodeSearchLevel;
          i++
        ) {
          if (i >= 0 && i <= 99) {
            range.push(pinBase + i.toString().padStart(2, "0"));
          }
        }

        filter.Pincode = { $in: range };
      }
    }

    // ✅ If ID is provided — fetch single business
    if (id && id !== "") {
      const businessData = await businessModel
        .findById(id)
        .populate("categories")
        .populate("shopkeeperId");

      if (!businessData) {
        return res.status(404).send({
          msg: "Business not found",
          data: null,
        });
      }

      return res.status(200).send({
        msg: "Business fetched successfully",
        data: businessData,
      });
    }

    // ✅ Fetch businesses
    const businessData = await businessModel
      .find(filter)
      .populate("categories")
      .populate({
        path: "shopkeeperId",
        select:
          "-password -email -createdAt -updatedAt -refreshToken -panCardNumber -aadhaarCardNumber -rationCardNumber -deviceDetails -walletDetails",
      });

    // ✅ Add level to response
    const enrichedData = businessData.map((biz) => {
      let level = null;

      if (pinLastTwo !== null && biz.Pincode?.startsWith(pinBase)) {
        const bizLastTwo = parseInt(biz.Pincode.slice(-2), 10);
        level = Math.abs(bizLastTwo - pinLastTwo);
      }

      return {
        ...biz.toObject(),
        level, // 👈 level added here
      };
    });

    // ✅ Sort by nearest first
    enrichedData.sort((a, b) => (a.level ?? 99) - (b.level ?? 99));

    if (!enrichedData.length) {
      return res.status(200).send({
        msg: "No businesses found",
        data: [],
      });
    }

    return res.status(200).send({
      msg: "Businesses fetched successfully",
      data: enrichedData,
    });
  } catch (error) {
    return res.status(400).send({
      msg: error.message,
    });
  }
};

module.exports = { addBusiness: addBusiness, getBusiness: getBusiness };
