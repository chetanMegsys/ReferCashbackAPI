const businessModel = require("../models/businessModel");
const fs = require("fs");
const path = require("path");
const user = require("../models/userModel");
const mongoose = require("mongoose");

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
//   const { id, searchText, categories, pincode } = req.body;

//   try {
//     let filter = {};

//     let pinBase = null;
//     let pinLastTwo = null;
//     const picodeSearchLevel = 3;
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

//     // ✅ Filter by nearby pincode (±5 levels)
//     if (pincode && pincode.toString().trim() !== "") {
//       const pinStr = pincode.toString();

//       if (pinStr.length >= 2) {
//         pinBase = pinStr.slice(0, -2); // e.g. "4110"
//         pinLastTwo = parseInt(pinStr.slice(-2), 10); // e.g. 33

//         const range = [];
//         for (
//           let i = pinLastTwo - picodeSearchLevel;
//           i <= pinLastTwo + picodeSearchLevel;
//           i++
//         ) {
//           if (i >= 0 && i <= 99) {
//             range.push(pinBase + i.toString().padStart(2, "0"));
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
//         return res.status(404).send({
//           msg: "Business not found",
//           data: null,
//         });
//       }

//       return res.status(200).send({
//         msg: "Business fetched successfully",
//         data: businessData,
//       });
//     }

//     // ✅ Fetch businesses
//     const businessData = await businessModel
//       .find(filter)
//       .populate("categories")
//       .populate({
//         path: "shopkeeperId",
//         select:
//           "-password -email -createdAt -updatedAt -refreshToken -panCardNumber -aadhaarCardNumber -rationCardNumber -deviceDetails -walletDetails",
//       });

//     // ✅ Add level to response
//     const enrichedData = businessData.map((biz) => {
//       let level = null;

//       if (pinLastTwo !== null && biz.Pincode?.startsWith(pinBase)) {
//         const bizLastTwo = parseInt(biz.Pincode.slice(-2), 10);
//         level = Math.abs(bizLastTwo - pinLastTwo);
//       }

//       return {
//         ...biz.toObject(),
//         level, // 👈 level added here
//       };
//     });

//     // ✅ Sort by nearest first
//     enrichedData.sort((a, b) => (a.level ?? 99) - (b.level ?? 99));

//     if (!enrichedData.length) {
//       return res.status(200).send({
//         msg: "No businesses found",
//         data: [],
//       });
//     }

//     return res.status(200).send({
//       msg: "Businesses fetched successfully",
//       data: enrichedData,
//     });
//   } catch (error) {
//     return res.status(400).send({
//       msg: error.message,
//     });
//   }
// };

const getBusiness = async (req, res) => {
  try {
    const { id, searchText, categories, pincode } = req.body;

    let pipeline = [];

    // =========================
    // 1️⃣ ID Filter
    // =========================
    if (id) {
      pipeline.push({
        $match: {
          _id: new mongoose.Types.ObjectId(id),
        },
      });
    }

    // =========================
    // 2️⃣ Category Filter ($in FIXED)
    // =========================
    if (categories) {
      const categoryArray = Array.isArray(categories)
        ? categories
        : [categories];

      pipeline.push({
        $match: {
          categories: {
            $in: categoryArray.map((c) => new mongoose.Types.ObjectId(c)),
          },
        },
      });
    }

    // =========================
    // 3️⃣ Pincode Filter
    // =========================
    if (pincode && pincode.toString().trim() !== "") {
      pipeline.push({
        $match: {
          Pincode: pincode.toString(),
        },
      });
    }

    // =========================
    // 4️⃣ Lookup Users (Shopkeeper)
    // =========================
    // =========================
    // 4️⃣ Lookup Users
    // =========================
    pipeline.push({
      $lookup: {
        from: "users",
        let: { shopkeeperId: "$shopkeeperId" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$_id", "$$shopkeeperId"] },
            },
          },
          {
            $project: {
              password: 0,
              createdAt: 0,
              updatedAt: 0,
              refreshToken: 0,
              panCardNumber: 0,
              aadhaarCardNumber: 0,
              rationCardNumber: 0,
              deviceDetails: 0,
              walletDetails: 0,
            },
          },
        ],
        as: "shopkeeperId",
      },
    });

    // 🔥 IMPORTANT: Unwind Here
    pipeline.push({
      $unwind: {
        path: "$shopkeeperId",
        preserveNullAndEmptyArrays: true,
      },
    });

    // =========================
    // 5️⃣ Lookup Categories
    // =========================
    pipeline.push({
      $lookup: {
        from: "categories",
        localField: "categories",
        foreignField: "_id",
        as: "categories",
      },
    });

    // =========================
    // 6️⃣ Search (Business + Mobile)
    // =========================
    if (searchText && searchText.trim() !== "") {
      const regex = new RegExp(searchText, "i");

      pipeline.push({
        $match: {
          $or: [
            { businessName: regex },
            { address: regex },
            { Pincode: regex },
            { "shopkeeperId.mobile": regex }, // ✅ mobile search
          ],
        },
      });
    }

    // =========================
    // 7️⃣ Execute
    // =========================
    const businessData = await businessModel.aggregate(pipeline);

    return res.status(200).send({
      msg:
        businessData.length > 0
          ? "Businesses fetched successfully"
          : "No businesses found",
      data: businessData,
    });
  } catch (error) {
    return res.status(500).send({
      msg: error.message,
    });
  }
};
module.exports = { addBusiness: addBusiness, getBusiness: getBusiness };
