const mongoose = require("mongoose");
const transactionModel = require("../models/transactionModel");
const Orders = require("../models/orderModel");
const Business = require("../models/businessModel");
const Users = require("../models/userModel");
const { paginateArray } = require("../CommanFuntion/Pagination");
const { formatTo12Hour } = require("../CommanFuntion/convertTo12hours");

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

// const getUserTransaction = async (req, res) => {
//   const { userId } = req.body;

//   try {
//     const sixMonthsAgo = new Date();
//     sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

//     let matchStage = {};

//     if (userId) {
//       matchStage = {
//         userId: new mongoose.Types.ObjectId(userId),
//         date: { $gte: sixMonthsAgo },
//       };
//     } else {
//       matchStage = {
//         date: { $gte: sixMonthsAgo },
//       };
//     }
//     const result = await transactionModel.aggregate([
//       {
//         $match: matchStage,
//       },
//       {
//         $lookup: {
//           from: "orders",
//           localField: "orderId",
//           foreignField: "_id",
//           as: "order",
//         },
//       },
//       { $unwind: { path: "$order", preserveNullAndEmptyArrays: true } },
//       {
//         $lookup: {
//           from: "businesses",
//           localField: "order.businessId",
//           foreignField: "_id",
//           as: "business",
//         },
//       },
//       { $unwind: { path: "$business", preserveNullAndEmptyArrays: true } },
//       {
//         $lookup: {
//           from: "users",
//           localField: "order.shopkeeperId",
//           foreignField: "_id",
//           as: "shopkeeper",
//         },
//       },
//       { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
//       {
//         $lookup: {
//           from: "users",
//           localField: "userId",
//           foreignField: "_id",
//           as: "customer",
//         },
//       },
//       { $unwind: { path: "$shopkeeper", preserveNullAndEmptyArrays: true } },
//       {
//         $addFields: {
//           actualDate: {
//             $cond: [
//               { $ifNull: ["$order.createdAt", false] },
//               "$order.createdAt",
//               { $ifNull: ["$date", new Date(0)] },
//             ],
//           },
//         },
//       },
//       { $match: { actualDate: { $ne: null } } },
//       {
//         $addFields: {
//           month: {
//             $dateToString: {
//               format: "%b %Y",
//               date: { $ifNull: ["$actualDate", new Date(0)] },
//               timezone: "Asia/Kolkata",
//             },
//           },
//           formattedDate: {
//             $dateToString: {
//               format: "%d/%m/%Y %H:%M", // ✅ valid in MongoDB
//               date: { $ifNull: ["$actualDate", new Date(0)] },
//               timezone: "Asia/Kolkata",
//             },
//           },
//         },
//       },
//       { $sort: { actualDate: -1 } },
//       {
//         $group: {
//           _id: "$month",
//           monthSort: { $first: "$actualDate" },
//           transactions: { $push: "$$ROOT" },
//         },
//       },
//       {
//         $project: {
//           "user.password": 0,
//           "shopkeeper.password": 0,
//         },
//       },
//       { $sort: { monthSort: -1 } },
//     ]);

//     // ✅ Convert to 12-hour format with AM/PM manually
//     const formatTo12Hour = (dateStr) => {
//       try {
//         const date = new Date(dateStr);
//         return date.toLocaleString("en-IN", {
//           day: "2-digit",
//           month: "2-digit",
//           year: "numeric",
//           hour: "2-digit",
//           minute: "2-digit",
//           hour12: true,
//           timeZone: "Asia/Kolkata",
//         });
//       } catch {
//         return dateStr;
//       }
//     };

//     const data = {};
//     result.forEach((item) => {
//       data[item._id] = item.transactions.map((t) => ({
//         ...t,
//         formattedDate: formatTo12Hour(t.actualDate),
//       }));
//     });

//     return res.status(200).send({
//       msg: "Transactions retrieved successfully",
//       data,
//     });
//   } catch (error) {
//     console.error("❌ Transaction Error Stack:", error.stack);
//     console.error("❌ Transaction Error Message:", error.message);
//     return res.status(500).send({ msg: error.message, data: null });
//   }
// };

const getUserTransaction = async (req, res) => {
  const {
    userId,
    pageNumber,
    pageLimit,
    isPagination,
    isMonthWise = true,
    orderId,
    searchText,
  } = req.body;

  try {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    let matchStage = {
      date: { $gte: sixMonthsAgo },
    };
    if (userId) {
      matchStage.userId = new mongoose.Types.ObjectId(userId);
    } else if (orderId) {
      matchStage.orderId = new mongoose.Types.ObjectId(orderId);
    }

    const result = await transactionModel.aggregate([
      { $match: matchStage },
      {
        $lookup: {
          from: "orders",
          localField: "orderId",
          foreignField: "_id",
          as: "order",
        },
      },
      { $unwind: { path: "$order", preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: "businesses",
          localField: "order.businessId",
          foreignField: "_id",
          as: "business",
        },
      },
      { $unwind: { path: "$business", preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: "users",
          localField: "order.shopkeeperId",
          foreignField: "_id",
          as: "shopkeeper",
        },
      },
      { $unwind: { path: "$shopkeeper", preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "customer",
        },
      },
      { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          actualDate: {
            $ifNull: ["$order.createdAt", "$date"],
          },
        },
      },

      {
        $addFields: {
          month: {
            $dateToString: {
              format: "%b %Y",
              date: "$actualDate",
              timezone: "Asia/Kolkata",
            },
          },
        },
      },

      { $sort: { actualDate: -1 } },

      {
        $project: {
          transactionType: 1,
          category: 1,
          amount: 1,
          narration: 1,
          actualDate: 1,
          date: 1,
          month: 1,
          transactionId: 1,

          "order._id": 1,
          "order.amount": 1,
          "order.status": 1,
          "order.createdAt": 1,

          "business.businessName": 1,
          "business.businessId": 1,

          "shopkeeper.firstName": 1,
          "shopkeeper.lastName": 1,
          "shopkeeper.mobile": 1,
          "shopkeeper.imageUrl": 1,

          "customer.firstName": 1,
          "customer.lastName": 1,
          "customer.mobile": 1,
          "customer.imageUrl": 1,
        },
      },
    ]);

    // ✅ Date formatter
    // const formatTo12Hour = (date) =>
    //   new Date(date).toLocaleString("en-IN", {
    //     day: "2-digit",
    //     month: "2-digit",
    //     year: "numeric",
    //     hour: "2-digit",
    //     minute: "2-digit",
    //     hour12: true,
    //     timeZone: "Asia/Kolkata",
    //   });

    // 🔹 Pagination applied on flat list
    const paginated = paginateArray({
      data: result,
      page: pageNumber,
      limit: pageLimit,
      isPagination: isPagination,
      search: searchText, // 🔍 from req.body or req.query
      searchKeys: [
        "narration",
        "category",
        "transactionType",
        "amount",
        "transactionId",
        "month",
        "business.businessName",
        "shopkeeper.firstName",
        "shopkeeper.lastName",
        "shopkeeper.mobile",
        "customer.firstName",
        "customer.lastName",
        "customer.mobile",
        "order.status",
        "order.amount",
        "order.amount",
      ],
    });

    let finalData;

    if (isMonthWise) {
      finalData = paginated.data.reduce((acc, t) => {
        if (!acc[t.month]) acc[t.month] = [];

        acc[t.month].push({
          ...t,
          formattedDate: formatTo12Hour(t.date),
        });

        return acc;
      }, {});
    } else {
      finalData = paginated.data.map((t) => ({
        ...t,
        formattedDate: formatTo12Hour(t.date),
      }));
    }

    return res.status(200).send({
      msg: "Transactions retrieved successfully",
      data: finalData,
      pagination: paginated.pagination,
    });
  } catch (error) {
    console.error("❌ Transaction Error:", error);
    return res.status(500).send({
      msg: error.message,
      data: null,
    });
  }
};

module.exports = {
  creditAmount: creditAmount,
  getWalletDetails: getWalletDetails,
  getUserTransaction: getUserTransaction,
};
