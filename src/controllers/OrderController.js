const { mongoose } = require("mongoose");
const orderModel = require("../models/orderModel");
const transactionModel = require("../models/transactionModel");

const getWalletDetails = async (userId) => {
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

  return result.length > 0
    ? result[0]
    : { balance: 0, cashback: 0, referral: 0 };
};

const getOrders = async (req, res) => {
  const { id, orderId, shopkeeperId, userId, businessId } = req.body;
  let query = {};

  if (id) {
    query._id = id;
  }
  if (orderId) {
    query.orderId = orderId;
  }
  if (shopkeeperId) {
    query.shopkeeperId = shopkeeperId;
  }
  try {
    const ordersData = await orderModel
      .find(query)
      .sort({ createdAt: -1 })
      .populate("userId")
      .populate("businessId")
      .populate("shopkeeperId");
    if (!ordersData) {
      return res.status(400).send({ msg: "No orders present" });
    }
    return res
      .status(200)
      .send({ msg: "Orders fetched sucessfully", data: ordersData });
  } catch (error) {
    return res.status(400).send({ msg: error.message });
  }
};

const createOrder = async (req, res) => {
  try {
    const { userId, shopkeeperId, businessId, amount, isWalletSelected } =
      req.body;
    if (isWalletSelected) {
      const walletDetails = await getWalletDetails(userId);

      if (walletDetails.balance < amount) {
        return res.status(400).send({ msg: "Insufficient Wallet Balance" });
      }
    }

    //creating order

    const newOrder = new orderModel({
      userId,
      shopkeeperId,
      businessId,
      amount,

      isWalletSelected,
      status: "Pending",
    });

    await newOrder.save();

    if (!newOrder) {
      return res.status(400).send({ msg: "Order creation failed", data: null });
    }

    //Recording debit transaction for that user
    await transactionModel.create({
      userId,
      transactionType: "debit",
      amount,
      orderId: newOrder._id,
      category: "order",
      narration: `Order placed of amount ${amount}`,
    });

    res.status(200).send({
      msg: "Order created successfully.",
      data: newOrder,
    });
  } catch (error) {
    return res.status(500).send({ msg: error.message, data: null });
  }
};

const acceptOrRejectOrder = async (req, res) => {
  try {
    const { id, status } = req.body;

    if (!id || !status) {
      return res
        .status(400)
        .send({ msg: " Please Enter the id and status", data: null });
    }

    const order = await orderModel.findById(id);
    if (!order) {
      return res.status(404).send({ msg: "Order not found" });
    }

    if (order.status !== "Pending") {
      return res.status(400).send({ msg: `Order already ${order.status}` });
    }

    if (status === "accept") {
      order.status = "Accepted";
      await order.save();

      //crediting amount to shopkeeper wallet
      const addTransaction = await transactionModel.create({
        userId: order.shopkeeperId,
        transactionType: "credit",
        amount: order.amount,
        orderId: order._id,
        category: "order",
        narration: `Order ${order._id} accepted`,
      });

      if (!addTransaction) {
        return res.status(400).send({
          msg: "Order accepted but amount did not credit",
          data: null,
        });
      }
      return res
        .status(200)
        .send({ msg: "Order accepted and amount credited to shopkeeper" });
    } else if (status === "reject") {
      // Update order status
      order.status = "Rejected";
      await order.save();

      // Refund amount to user if wallet was selected
      let transaction = null;
      if (order.isWalletSelected) {
        transaction = await transactionModel.create({
          userId: order.userId,
          orderId: order._id,
          transactionType: "credit",
          amount: order.amount,
          category: "order",
          narration: `amount refunded`,
        });
      }

      if (order.isWalletSelected && !transaction) {
        return res
          .status(400)
          .send({ msg: "Order rejected but amount refund failed" });
      }
      return res
        .status(200)
        .send({ msg: "Order rejected and amount refunded to user wallet" });
    }
  } catch (error) {
    return res.status(500).send({ msg: error.message });
  }
};

const cancelOrder = async (req, res) => {
  try {
    const { id } = req.body;
    if (!id || id === "") {
      return res.status(400).send({ msg: " Id is required", data: null });
    }

    const order = await orderModel.findById(id);
    if (!order) {
      return res.status(404).send({ msg: "Order not found" });
    }

    if (order.status !== "Pending") {
      return res.status(400).send({ msg: `Order already ${order.status}` });
    }

    // Cancel the order
    order.status = "Cancelled";
    await order.save();

    let transaction = null;
    // Refund if wallet was selected
    if (order?.isWalletSelected) {
      transaction = await transactionModel.create({
        userId: order.userId,
        order: order._id,
        transactionType: "credit",
        amount: order.amount,
        category: "order",
        narration: `Order ${order._id} cancelled - refund to wallet`,
      });
    }

    if (order.isWalletSelected && !transaction) {
      return res.status(400).send({
        msg: "Order cancelled but refund failed",
        data: null,
      });
    }

    return res.status(200).send({
      msg: order.isWalletSelected
        ? "Order cancelled and amount refunded to user wallet"
        : "Order cancelled successfully",
    });
  } catch (error) {
    return res.status(500).send({ msg: error.message, data: null });
  }
};

// const getOrdersByMonth = async (req, res) => {
//   const { userId } = req.body;

//   if (!userId) {
//     return res.status(400).send({ msg: "No such userId" });
//   }
//   const result = await orderModel.aggregate([
//     {
//       $match: {
//         userId: new mongoose.Types.ObjectId(userId),
//       },
//     },
//     {
//       $addFields: {
//         monthYear: {
//           $dateToString: {
//             format: "%B %Y", // e.g., September 2025
//             date: "$date", // <-- use your "date" field
//           },
//         },
//         formattedDate: {
//           $dateToString: {
//             format: "%d %B %Y", // e.g., 01 September 2025
//             date: "$date", // <-- use your "date" field
//           },
//         },
//       },
//     },
//     { $sort: { date: -1 } }, // latest first
//     {
//       $group: {
//         _id: "$monthYear",
//         orders: {
//           $push: {
//             id: "$_id",
//             name: { $ifNull: ["$narration", "$category"] },
//             date: "$formattedDate",
//             amount: "$amount",
//             image: { $literal: "profilePic" },
//             reward: { $ifNull: ["$rewardPoints", 0] },
//           },
//         },
//       },
//     },
//     {
//       $project: {
//         month: "$_id",
//         orders: 1,
//         _id: 0,
//       },
//     },
//     { $sort: { month: -1 } },
//   ]);
// };

// const getOrdersByMonth = async (req, res) => {
//   try {
//     const { userId } = req.body;

//     if (!userId) {
//       return res.status(400).send({ msg: "No such userId" });
//     }

//     const result = await orderModel.aggregate([
//       {
//         $match: {
//           userId: new mongoose.Types.ObjectId(userId),
//         },
//       },
//       {
//         $lookup: {
//           from: "businesses",
//           localField: "businessId",
//           foreignField: "_id",
//           as: "business",
//         },
//       },
//       { $unwind: "$business" },
//       {
//         $addFields: {
//           monthYear: {
//             $dateToString: {
//               format: "%B ’%y", // e.g., July ’25
//               date: "$createdAt",
//             },
//           },
//           formattedDate: {
//             $dateToString: {
//               format: "%d %B ’%y", // e.g., 30 July ’25
//               date: "$createdAt",
//             },
//           },
//         },
//       },
//       { $sort: { createdAt: -1 } }, // latest first
//       {
//         $group: {
//           _id: "$monthYear",
//           orders: {
//             $push: {
//               id: "$_id",
//               name: "$business.businessName",
//               date: "$formattedDate",
//               amount: "$amount",
//               image: { $literal: "profilePic" },
//               reward: { $floor: { $multiply: ["$amount", 0.1] } }, // 10% reward example
//             },
//           },
//         },
//       },
//       {
//         $project: {
//           month: "$_id",
//           orders: 1,
//           _id: 0,
//         },
//       },
//       { $sort: { month: -1 } },
//     ]);

//     res.status(200).send({
//       msg: "Order history fetched successfully",
//       data: result,
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).send({
//       msg: "Something went wrong",
//       error: error.message,
//     });
//   }
// };

const getOrdersByMonth = async (req, res) => {
  try {
    const { userId, shopkeeperId } = req.body;

    if (!userId && !shopkeeperId) {
      return res.status(400).send({ msg: "userId or shopkeeperId required" });
    }

    const matchCondition = {};
    if (userId) {
      matchCondition.userId = new mongoose.Types.ObjectId(userId);
    }
    if (shopkeeperId) {
      matchCondition.shopkeeperId = new mongoose.Types.ObjectId(shopkeeperId);
    }

    const result = await orderModel.aggregate([
      {
        $match: matchCondition,
      },
      {
        $lookup: {
          from: "businesses",
          localField: "businessId",
          foreignField: "_id",
          as: "business",
        },
      },

      { $unwind: "$business" },

      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },

      {
        $addFields: {
          // Month-Year -> e.g., "July ’25"
          monthYear: {
            $concat: [
              {
                $dateToString: {
                  format: "%B", // Month full name
                  date: "$createdAt",
                },
              },
              " ’",
              {
                $substr: [
                  { $dateToString: { format: "%Y", date: "$createdAt" } },
                  2,
                  2,
                ],
              },
            ],
          },
          // Transaction date -> e.g., "30 July ’25"
          formattedDate: {
            $concat: [
              {
                $dateToString: {
                  format: "%d %B", // Day + Month
                  date: "$createdAt",
                },
              },
              " ’",
              {
                $substr: [
                  { $dateToString: { format: "%Y", date: "$createdAt" } },
                  2,
                  2,
                ],
              },
            ],
          },
        },
      },
      { $sort: { createdAt: -1 } }, // latest first
      {
        $group: {
          _id: "$monthYear",
          orders: {
            $push: {
              id: "$_id",
              name: "$business.businessName",
              date: "$formattedDate",
              amount: "$amount",
              image: "$user.imageUrl",
              userName: {
                $concat: ["$user.firstName", " ", "$user.lastName"],
              },
              status: "$status",
              // reward: { $floor: { $multiply: ["$amount", 0.1] } }, // 10% reward example
            },
          },
        },
      },
      {
        $project: {
          month: "$_id",
          orders: 1,
          _id: 0,
        },
      },
      { $sort: { month: -1 } },
    ]);

    res.status(200).send({
      msg: "Order history fetched successfully",
      data: result,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({
      msg: "Something went wrong",
      error: error.message,
    });
  }
};

module.exports = {
  getOrders: getOrders,
  createOrder: createOrder,
  acceptOrRejectOrder: acceptOrRejectOrder,
  getWalletDetails: getWalletDetails,
  cancelOrder: cancelOrder,
  getOrdersByMonth: getOrdersByMonth,
};
