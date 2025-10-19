const { mongoose } = require("mongoose");
const orderModel = require("../models/orderModel");
const userModel = require("../models/userModel");
const businessModel = require("../models/businessModel");
const transactionModel = require("../models/transactionModel");
const calculateCashbackHelper = require("../CommanFuntion/calculateCashbackHelper");

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

// const acceptOrRejectOrder = async (req, res) => {
//   try {
//     const { id, status } = req.body;

//     if (!id || !status) {
//       return res
//         .status(400)
//         .send({ msg: " Please Enter the id and status", data: null });
//     }

//     const order = await orderModel.findById(id);
//     if (!order) {
//       return res.status(404).send({ msg: "Order not found" });
//     }

//     if (order.status !== "Pending") {
//       return res.status(400).send({ msg: `Order already ${order.status}` });
//     }

//     if (status === "accept") {
//       order.status = "Accepted";
//       await order.save();

//       //crediting amount to shopkeeper wallet
//       const addTransaction = await transactionModel.create({
//         userId: order.shopkeeperId,
//         transactionType: "credit",
//         amount: order.amount,
//         orderId: order._id,
//         category: "order",
//         narration: `Order ${order._id} accepted`,
//       });

//       if (!addTransaction) {
//         return res.status(400).send({
//           msg: "Order accepted but amount did not credit",
//           data: null,
//         });
//       }
//       return res
//         .status(200)
//         .send({ msg: "Order accepted and amount credited to shopkeeper" });
//     } else if (status === "reject") {
//       // Update order status
//       order.status = "Rejected";
//       await order.save();

//       // Refund amount to user if wallet was selected
//       let transaction = null;
//       if (order.isWalletSelected) {
//         transaction = await transactionModel.create({
//           userId: order.userId,
//           orderId: order._id,
//           transactionType: "credit",
//           amount: order.amount,
//           category: "order",
//           narration: `amount refunded`,
//         });
//       }

//       if (order.isWalletSelected && !transaction) {
//         return res
//           .status(400)
//           .send({ msg: "Order rejected but amount refund failed" });
//       }
//       return res
//         .status(200)
//         .send({ msg: "Order rejected and amount refunded to user wallet" });
//     }
//   } catch (error) {
//     return res.status(500).send({ msg: error.message });
//   }
// };

// Helper: Update wallet safely

// Helper: update user wallet safely
const updateUserWallet = async (
  userId,
  amount,
  type = "referral",
  alsoAddBalance = false
) => {
  if (!userId || !amount || amount <= 0) return;

  const user = await userModel.findById(userId);
  if (!user) return;

  const updateObj = {};
  if (type === "customer") updateObj["walletDetails.cashbackPoints"] = amount;
  else updateObj["walletDetails.referralPoints"] = amount;

  if (alsoAddBalance) updateObj["walletDetails.balance"] = amount;

  await userModel.findByIdAndUpdate(userId, { $inc: updateObj });
};

const acceptOrRejectOrder = async (req, res) => {
  try {
    const { id, status } = req.body;

    if (!id || !status)
      return res.status(400).send({ msg: "Please enter id and status" });

    const order = await orderModel.findById(id);
    if (!order) return res.status(404).send({ msg: "Order not found" });

    if (order.status !== "Pending")
      return res.status(400).send({ msg: `Order already ${order.status}` });

    if (status === "accept") {
      order.status = "Accepted";

      // Credit shopkeeper amount
      if (order.shopkeeperId) {
        await updateUserWallet(
          order.shopkeeperId,
          order.amount,
          "referral",
          true
        );
        await transactionModel.create({
          userId: order.shopkeeperId,
          transactionType: "credit",
          orderId: order._id,
          amount: order.amount,
          category: "order",
          narration: `Order accepted`,
        });
      }

      // Calculate cashback
      const cashbackData = await calculateCashbackHelper({
        userId: order.userId,
        shopkeeperId: order.shopkeeperId,
        orderAmount: order.amount,
      });

      const receivers = cashbackData.cashbackReceivers;
      const allTransactions = [];

      // Customer
      if (receivers.customer?.cashback > 0) {
        await updateUserWallet(
          receivers.customer.userId,
          receivers.customer.cashback,
          "customer",
          true
        );
        allTransactions.push({
          userId: receivers.customer.userId,
          transactionType: "credit",
          orderId: order._id,
          amount: receivers.customer.cashback,
          category: "cashback",
          narration: "Customer cashback",
        });
      }

      // Referrer
      if (receivers.referrer?.cashback > 0) {
        await updateUserWallet(
          receivers.referrer.userId,
          receivers.referrer.cashback,
          "referral",
          true
        );
        allTransactions.push({
          userId: receivers.referrer.userId,
          transactionType: "credit",
          orderId: order._id,
          amount: receivers.referrer.cashback,
          category: "cashback",
          narration: "Referrer cashback",
        });
      }

      // Multi-level
      [receivers.levels, receivers.irot1, receivers.irot2].forEach((group) => {
        if (Array.isArray(group)) {
          group.forEach(async (entry) => {
            if (!entry) return;
            await updateUserWallet(
              entry.userId,
              entry.cashback,
              "referral",
              true
            );
            allTransactions.push({
              userId: entry.userId,
              transactionType: "credit",
              orderId: order._id,
              amount: entry.cashback,
              category: "cashback",
              narration: "Multi-level cashback",
            });
          });
        }
      });

      // ROR
      if (receivers.ror?.receiver) {
        await updateUserWallet(
          receivers.ror.receiver.userId,
          receivers.ror.receiver.cashback,
          "referral",
          true
        );
        allTransactions.push({
          userId: receivers.ror.receiver.userId,
          transactionType: "credit",
          orderId: order._id,
          amount: receivers.ror.receiver.cashback,
          category: "cashback",
          narration: "ROR cashback",
        });
      }

      // Shopkeeper
      if (receivers.shopkeeper?.cashback > 0) {
        await updateUserWallet(
          receivers.shopkeeper.userId,
          receivers.shopkeeper.cashback,
          "referral",
          true
        );
        allTransactions.push({
          userId: receivers.shopkeeper.userId,
          transactionType: "credit",
          orderId: order._id,
          amount: receivers.shopkeeper.cashback,
          category: "cashback",
          narration: "Shopkeeper cashback",
        });
      }

      // SuperAdmin (optional)
      if (receivers.superadmin?.cashback > 0) {
        allTransactions.push({
          userId: null,
          transactionType: "credit",
          orderId: order._id,
          amount: receivers.superadmin.cashback,
          category: "cashback",
          narration: "SuperAdmin cashback",
        });
      }

      // Save transactions
      if (allTransactions.length > 0)
        await transactionModel.insertMany(allTransactions);

      await order.save();
      return res.status(200).send({
        msg: "Order accepted and cashback distributed successfully",
        cashbackSummary: receivers,
      });
    }

    // REJECT
    else if (status === "reject") {
      order.status = "Rejected";
      await order.save();

      if (order.userId) {
        await updateUserWallet(order.userId, order.amount, "customer", true);
        await transactionModel.create({
          userId: order.userId,
          transactionType: "credit",
          orderId: order._id,
          amount: order.amount,
          category: "refund",
          narration: "Order refunded",
        });
      }

      return res
        .status(200)
        .send({ msg: "Order rejected and refunded successfully" });
    }
  } catch (err) {
    console.error("Error in acceptOrRejectOrder:", err);
    return res.status(500).send({
      msg: "Internal server error",
      error: err.message,
    });
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

// const calculateCashback = async (req, res) => {
//   try {
//     const { userId, shopkeeperId, orderAmount } = req.body;

//     if (!userId || !shopkeeperId || !orderAmount) {
//       return res.status(400).json({ message: "Missing required fields" });
//     }

//     // 🏪 Get discount/cashback percent from business table
//     const business = await businessModel
//       .findOne({ shopkeeperId })
//       .select("discountPercentage");
//     if (!business) {
//       return res.status(404).json({ message: "Shopkeeper not found" });
//     }

//     const cashbackPercent = business.discountPercentage || 0;
//     const totalCashback = (orderAmount * cashbackPercent) / 100;

//     // 🧮 Cashback distribution setup (percentage from env)
//     const distribution = {
//       customer: (totalCashback * process.env.CUSTOMER_PERCENTAGE) / 100,
//       referrer: (totalCashback * process.env.REFERRER_PERCENTAGE) / 100,
//       ror: (totalCashback * process.env.ROR_PERCENTAGE) / 100,
//       level: (totalCashback * process.env.LEVEL_PERCENTAGE) / 100,
//       irot1: (totalCashback * process.env.IROT1_PERCENTAGE) / 100,
//       irot2: (totalCashback * process.env.IROT2_PERCENTAGE) / 100,
//       tiup: (totalCashback * process.env.TIUP_PERCENTAGE) / 100,
//       superadmin: (totalCashback * process.env.SUPERADMIN_PERCENTAGE) / 100,
//     };

//     // 🧍 Find main user (customer)
//     const user = await userModel.findById(userId);
//     if (!user) return res.status(404).json({ message: "User not found" });

//     // 👥 Find referrer (direct)
//     const referrer =
//       user.referalUser &&
//       (await userModel
//         .findById(user.referalUser)
//         .select("firstName lastName mobile"));

//     // 🔗 Get up to 10-level referral chain
//     let currentRef = user.referalUser;
//     const levelUsers = [];
//     let level = 1;

//     while (currentRef && level <= 10) {
//       const refUser = await userModel
//         .findById(currentRef)
//         .select("firstName lastName email mobile referalUser");
//       if (!refUser) break;

//       levelUsers.push(refUser);
//       currentRef = refUser.referalUser;
//       level++;
//     }

//     const perLevelAmount =
//       levelUsers.length > 0 ? distribution.level / levelUsers.length : 0;

//     const levelDistribution = levelUsers.map((u, index) => ({
//       level: index + 1,
//       userId: u._id,
//       name: `${u.firstName || ""} ${u.lastName || ""}`.trim(),
//       mobile: u.mobile,
//       cashback: perLevelAmount,
//     }));

//     // 🧾 Map actual cashback recipients
//     const cashbackReceivers = {
//       customer: {
//         userId: user._id,
//         name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
//         cashback: distribution.customer,
//       },
//       referrer: referrer
//         ? {
//             userId: referrer._id,
//             name: `${referrer.firstName || ""} ${
//               referrer.lastName || ""
//             }`.trim(),
//             cashback: distribution.referrer,
//           }
//         : null,
//       tiup: {
//         // 🏪 Shopkeeper
//         shopkeeperId,
//         cashback: distribution.tiup,
//       },
//       superadmin: {
//         // 🏢 Main company
//         name: "SuperAdmin",
//         cashback: distribution.superadmin,
//       },
//       levels: levelDistribution,
//     };

//     // ✅ Return all calculated result
//     return res.status(200).json({
//       message: "Cashback calculation successful",
//       orderAmount,
//       cashbackPercent,
//       totalCashback,
//       distribution,
//       cashbackReceivers,
//       totalLevels: levelUsers.length,
//     });
//   } catch (err) {
//     console.error("Error calculating cashback:", err);
//     res.status(500).json({ message: "Server error" });
//   }
// };

const calculateCashback = async (req, res) => {
  try {
    let { userId, shopkeeperId, orderAmount } = req.body;

    if (!userId || !shopkeeperId || !orderAmount) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid userId" });
    }
    if (!mongoose.Types.ObjectId.isValid(shopkeeperId)) {
      return res.status(400).json({ message: "Invalid shopkeeperId" });
    }

    // Convert to ObjectId using 'new'
    userId = new mongoose.Types.ObjectId(userId);
    shopkeeperId = new mongoose.Types.ObjectId(shopkeeperId);

    const result = await calculateCashbackHelper({
      userId,
      shopkeeperId,
      orderAmount,
    });
    return res.status(200).json(result);
  } catch (err) {
    console.error("Error calculating cashback:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  getOrders: getOrders,
  createOrder: createOrder,
  acceptOrRejectOrder: acceptOrRejectOrder,
  getWalletDetails: getWalletDetails,
  cancelOrder: cancelOrder,
  getOrdersByMonth: getOrdersByMonth,
  calculateCashback: calculateCashback,
};
