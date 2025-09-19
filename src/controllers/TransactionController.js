const mongoose = require("mongoose");
const transactionModel = require("../models/transactionModel");

const creditAmount = async (req, res) => {
  try {
    const { userId, amount, category, narration } = req.body;

    if (!userId || !amount) {
      return res.status(400).send({
        msg: "Please provide userId and amount",
        data: null,
      });
    }

    // Create credit transaction
    const transaction = await transactionModel.create({
      userId: new mongoose.Types.ObjectId(userId),
      transactionType: "credit", // always credit for adding wallet balance
      amount,
      category: category,
      narration: narration || "Initial wallet balance for testing",
    });

    res.status(200).send({
      msg: "Wallet balance added successfully",
      data: transaction,
    });
  } catch (error) {
    res.status(500).send({ msg: error.message, data: null });
  }
};

const getWalletDetails = async (req, res) => {
  const { userId } = req.body;
  try {
    const result = await transactionModel.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: null,
          credits: {
            $sum: {
              $cond: [{ $eq: ["$transactionType", "credit"] }, "$amount", 0],
            },
          },
          debits: {
            $sum: {
              $cond: [{ $eq: ["$transactionType", "debit"] }, "$amount", 0],
            },
          },
          cashback: {
            $sum: {
              $cond: [{ $eq: ["$category", "cashback"] }, "$amount", 0],
            },
          },
          referral: {
            $sum: {
              $cond: [{ $eq: ["$category", "referral"] }, "$amount", 0],
            },
          },
        },
      },
      {
        $project: {
          balance: { $subtract: ["$credits", "$debits"] },
          cashback: 1,
          referral: 1,
        },
      },
    ]);

    return res
      .status(200)
      .send(
        result.length > 0 ? result[0] : { balance: 0, cashback: 0, referral: 0 }
      );
  } catch (error) {
    return res.status(500).send({ msg: error.message });
  }
};

// const getTransactionHistory = async (req, res) => {
//   try {
//     const { userId } = req.body;
//     if (!userId) {
//       return res.status(400).send({
//         msg: "Please provide userId",
//         data: null,
//       });
//     }

//     const result = await transactionModel.aggregate([
//       {
//         $match: {
//           userId: new mongoose.Types.ObjectId(userId),
//           category: "order", // only order transactions
//         },
//       },
//       {
//         $addFields: {
//           monthYear: {
//             $dateToString: {
//               format: "%B %Y", // e.g., September 2025
//               date: "$date", // <-- use your "date" field
//             },
//           },
//           formattedDate: {
//             $dateToString: {
//               format: "%d %B %Y", // e.g., 01 September 2025
//               date: "$date", // <-- use your "date" field
//             },
//           },
//         },
//       },
//       { $sort: { date: -1 } }, // latest first
//       {
//         $group: {
//           _id: "$monthYear",
//           transactions: {
//             $push: {
//               id: "$_id",
//               name: { $ifNull: ["$narration", "$category"] },
//               date: "$formattedDate",
//               amount: "$amount",
//               image: { $literal: "profilePic" },
//               reward: { $ifNull: ["$rewardPoints", 0] },
//             },
//           },
//         },
//       },
//       {
//         $project: {
//           month: "$_id",
//           transactions: 1,
//           _id: 0,
//         },
//       },
//       { $sort: { month: -1 } },
//     ]);

//     return res.status(200).send({
//       msg: "Transaction history fetched successfully",
//       data: result,
//     });
//   } catch (error) {
//     return res.status(500).send({ msg: error.message, data: null });
//   }
// };

// const getTransactionHistory = async (req, res) => {
//   try {
//     const { userId } = req.body;

//     const result = await transactionModel.aggregate([
//       {
//         $match: {
//           userId: new mongoose.Types.ObjectId(userId),
//           category: "order", // only order category
//         },
//       },
//       // Join with orders
//       {
//         $lookup: {
//           from: "orders",
//           localField: "orderId",
//           foreignField: "_id",
//           as: "order",
//         },
//       },
//       { $unwind: "$order" },

//       // Join with businesses
//       {
//         $lookup: {
//           from: "businesses",
//           localField: "order.businessId",
//           foreignField: "_id",
//           as: "business",
//         },
//       },
//       { $unwind: "$business" },

//       // Join with users
//       {
//         $lookup: {
//           from: "users",
//           localField: "userId",
//           foreignField: "_id",
//           as: "user",
//         },
//       },
//       { $unwind: "$user" },

//       // Format fields
//       {
//         $addFields: {
//           month: {
//             $dateToString: { format: "%B %Y", date: "$order.createdAt" },
//           },
//           formattedDate: {
//             $dateToString: { format: "%d %B %Y", date: "$order.createdAt" },
//           },
//         },
//       },

//       // Final projection
//       {
//         $project: {
//           _id: 0,
//           id: "$_id",
//           name: "$business.businessName", //businessName instead of narration
//           date: "$formattedDate", // from order createdAt
//           amount: "$order.amount", //  from order amount
//           image: { $ifNull: ["$user.imageUrl", "profilePic"] }, //  from user
//           reward: { $literal: 0 },
//           month: 1,
//         },
//       },

//       // Group by month
//       {
//         $group: {
//           _id: "$month",
//           transactions: { $push: "$$ROOT" },
//         },
//       },
//       {
//         $project: {
//           _id: 0,
//           month: "$_id",
//           transactions: 1,
//         },
//       },

//       // Sort latest month first
//       { $sort: { month: -1 } },
//     ]);

//     res.status(200).send({
//       msg: "Transaction history fetched successfully",
//       data: result,
//     });
//   } catch (error) {
//     res.status(500).send({ msg: error.message, data: null });
//   }
// };

module.exports = {
  creditAmount: creditAmount,
  getWalletDetails: getWalletDetails,
};
