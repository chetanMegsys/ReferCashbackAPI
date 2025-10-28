const { mongoose } = require("mongoose");
const orderModel = require("../models/orderModel");
const userModel = require("../models/userModel");
const businessModel = require("../models/businessModel");
const transactionModel = require("../models/transactionModel");
const calculateCashbackHelper = require("../CommanFuntion/calculateCashbackHelper");

const getWalletDetails = async (userId) => {
  const user = await userModel
    .findById(userId)
    .select(
      "walletDetails.balance walletDetails.cashbackPoints walletDetails.referralPoints"
    );

  if (!user || !user.walletDetails) {
    return { balance: 0, cashback: 0, referral: 0 };
  }

  const { balance, cashbackPoints, referralPoints } = user.walletDetails;

  return {
    balance: balance || 0,
    cashback: cashbackPoints || 0,
    referral: referralPoints || 0,
  };
};

// const getOrders = async (req, res) => {
//   const { id, orderId, shopkeeperId, userId, businessId } = req.body;
//   let query = {};

//   if (id) {
//     query._id = id;
//   }
//   if (orderId) {
//     query.orderId = orderId;
//   }
//   if (shopkeeperId) {
//     query.shopkeeperId = shopkeeperId;
//   }
//   try {
//     const ordersData = await orderModel
//       .find(query)
//       .sort({ createdAt: -1 })
//       .populate("userId")
//       .populate("businessId")
//       .populate("shopkeeperId");
//     if (!ordersData) {
//       return res.status(400).send({ msg: "No orders present" });
//     }
//     return res
//       .status(200)
//       .send({ msg: "Orders fetched sucessfully", data: ordersData });
//   } catch (error) {
//     return res.status(400).send({ msg: error.message });
//   }
// };

const getOrders = async (req, res) => {
  const { shopkeeperId, orderId, status } = req.body; // changed userId to shopkeeperId

  try {
    let query = {};

    // Both shopkeeperId and orderId provided → specific order
    if (shopkeeperId && orderId) {
      query.shopkeeperId = shopkeeperId;
      query.orderId = orderId;
    }
    // Only shopkeeperId provided → fetch orders (default status = "Pending")
    else if (shopkeeperId) {
      query.shopkeeperId = shopkeeperId;
      query.status = status || "Pending"; // default to Pending
    }

    // If status is provided without shopkeeperId → fetch all orders with that status
    if (status && !shopkeeperId) {
      query.status = status;
    }

    const ordersData = await orderModel
      .find(query)
      .sort({ createdAt: -1 })
      .populate("userId", "firstName lastName email imageUrl")
      .populate("shopkeeperId", "firstName lastName email imageUrl")
      .populate("businessId", "name");

    if (!ordersData || ordersData.length === 0) {
      return res.status(404).send({ msg: "No orders present" });
    }

    return res
      .status(200)
      .send({ msg: "Orders fetched successfully", data: ordersData });
  } catch (error) {
    return res.status(500).send({ msg: error.message });
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
    // 🔹 Calculate cashback summary (only summary stored)
    const { cashbackSummary } = await calculateCashbackHelper({
      userId,
      shopkeeperId,
      orderAmount: amount,
    });
    const newOrder = new orderModel({
      userId,
      shopkeeperId,
      businessId,
      amount,

      isWalletSelected,
      status: "Pending",
      cashbackSummary,
    });

    await newOrder.save();

    if (!newOrder) {
      return res.status(400).send({ msg: "Order creation failed", data: null });
    }

    //Recording debit transaction for that user
    if (isWalletSelected) {
      await transactionModel.create({
        userId,
        transactionType: "debit",
        amount,
        orderId: newOrder._id,
        category: "order",
        narration: `Order placed of amount ${amount}`,
      });
      await userModel.findByIdAndUpdate(
        userId,
        { $inc: { "walletDetails.balance": -amount } }, // decrement balance
        { new: true }
      );
    }

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
    const { id, status, userId } = req.body; // userId from req.body or auth token

    if (!id || !status || !userId)
      return res
        .status(400)
        .send({ msg: "Please enter id, status, and userId" });

    // 🔹 Find order
    const order = await orderModel.findById(id);
    if (!order) return res.status(404).send({ msg: "Order not found" });

    // 🔹 Check that this user is the correct shopkeeper
    if (order.shopkeeperId.toString() !== userId.toString()) {
      return res.status(403).send({
        msg: "Unauthorized: This order does not belong to the logged-in shopkeeper",
      });
    }

    // 🔹 Prevent duplicate status update
    if (order.status !== "Pending")
      return res.status(400).send({ msg: `Order already ${order.status}` });

    // --------------------------
    // ACCEPT ORDER
    // --------------------------
    if (status === "accept") {
      order.status = "Accepted";

      // 🔹 Calculate cashback
      const { cashbackReceivers, cashbackSummary } =
        await calculateCashbackHelper({
          userId: order.userId,
          shopkeeperId: order.shopkeeperId,
          orderAmount: order.amount,
        });

      const allTransactions = [];

      // 🔹 Net order amount to shopkeeper
      const netShopkeeperAmount =
        order.amount - cashbackReceivers?.totalCashback;

      if (netShopkeeperAmount > 0) {
        await updateUserWallet(
          order.shopkeeperId,
          netShopkeeperAmount,
          "referral",
          true
        );
        // not confirm to this amoutn wich location this temp
        // allTransactions.push({
        //   userId: order.shopkeeperId,
        //   transactionType: "credit",
        //   orderId: order._id,
        //   amount: netShopkeeperAmount,
        //   category: "order",
        //   narration: "Order accepted (after cashback deduction)",
        // });
      }

      // --------------------------
      // Cashback distribution
      // --------------------------

      // 🔹 Customer cashback
      if (cashbackReceivers.customer?.cashback > 0) {
        await updateUserWallet(
          cashbackReceivers.customer.userId,
          cashbackReceivers.customer.cashback,
          "customer",
          true
        );
        allTransactions.push({
          userId: cashbackReceivers.customer.userId,
          transactionType: "credit",
          orderId: order._id,
          amount: cashbackReceivers.customer.cashback,
          category: "cashback",
          narration: "Customer cashback",
        });
      }

      // 🔹 Referrer cashback
      if (cashbackReceivers.referrer?.cashback > 0) {
        await updateUserWallet(
          cashbackReceivers.referrer.userId,
          cashbackReceivers.referrer.cashback,
          "referral",
          true
        );
        allTransactions.push({
          userId: cashbackReceivers.referrer.userId,
          transactionType: "credit",
          orderId: order._id,
          amount: cashbackReceivers.referrer.cashback,
          category: "cashback",
          narration: "Referrer cashback",
        });
      }

      // 🔹 Multi-level cashback: LEVELS, IROT-1, IROT-2
      const multiLevelGroups = [
        { group: cashbackReceivers.levels, type: "LEVELS" },
        { group: cashbackReceivers.irot1, type: "IROT-1" },
        { group: cashbackReceivers.irot2, type: "IROT-2" },
      ];

      for (const { group, type } of multiLevelGroups) {
        if (Array.isArray(group)) {
          for (const entry of group) {
            if (!entry) continue;
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
              narration: `${type} cashback`,
            });
          }
        }
      }

      // 🔹 ROR cashback
      if (cashbackReceivers.ror?.receiver) {
        await updateUserWallet(
          cashbackReceivers.ror.receiver.userId,
          cashbackReceivers.ror.receiver.cashback,
          "referral",
          true
        );
        allTransactions.push({
          userId: cashbackReceivers.ror.receiver.userId,
          transactionType: "credit",
          orderId: order._id,
          amount: cashbackReceivers.ror.receiver.cashback,
          category: "cashback",
          narration: "ROR cashback",
        });
      }

      // 🔹 Shopkeeper cashback (separate entry)
      if (cashbackReceivers.shopkeeper?.cashback > 0) {
        await updateUserWallet(
          cashbackReceivers.shopkeeper.userId,
          cashbackReceivers.shopkeeper.cashback,
          "referral",
          true
        );
        allTransactions.push({
          userId: cashbackReceivers.shopkeeper.userId,
          transactionType: "credit",
          orderId: order._id,
          amount: cashbackReceivers.shopkeeper.cashback,
          category: "cashback",
          narration: "Shopkeeper cashback",
        });
      }

      // 🔹 SuperAdmin cashback
      if (
        Array.isArray(cashbackReceivers.superadmin) &&
        cashbackReceivers.superadmin.length > 0
      ) {
        for (const admin of cashbackReceivers.superadmin) {
          await updateUserWallet(
            admin.userId,
            admin.cashback,
            "referral",
            true
          );
          allTransactions.push({
            userId: admin.userId,
            transactionType: "credit",
            orderId: order._id,
            amount: admin.cashback,
            category: "cashback",
            narration: "SuperAdmin cashback",
          });
        }
      }

      // 🔹 Save all transactions
      if (allTransactions.length > 0)
        await transactionModel.insertMany(allTransactions);

      await order.save();
      return res.status(200).send({
        msg: "Order accepted and cashback distributed successfully",
        cashbackSummary,
      });
    }

    // --------------------------
    // REJECT ORDER
    // --------------------------
    else if (status === "reject") {
      order.status = "Rejected";
      await order.save();

      // Refund only if order was paid using wallet
      if (order?.isWalletSelected) {
        const amount = Number(order.amount) || 0;

        // 1️⃣ Refund to wallet
        await updateUserWallet(order.userId, amount, "cutomer", true);

        // 2️⃣ Log refund transaction
        await transactionModel.create({
          userId: order.userId,
          transactionType: "credit",
          orderId: order._id,
          amount,
          category: "refund",
          narration: `Order ${order.orderId} rejected - amount refunded to wallet`,
        });

        return res.status(200).send({
          msg: "Order rejected and wallet refund processed successfully",
        });
      }

      // If order was NOT paid by wallet → no refund needed
      return res.status(200).send({
        msg: "Order rejected successfully (no wallet refund)",
      });
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

    if (!id) {
      return res.status(400).send({ msg: "Order ID is required", data: null });
    }

    const order = await orderModel.findById(id);
    if (!order) {
      return res.status(404).send({ msg: "Order not found" });
    }

    if (order.status !== "Pending") {
      return res
        .status(400)
        .send({ msg: `Order already ${order.status}`, data: null });
    }

    // 1️⃣ Cancel the order
    order.status = "Cancelled";
    await order.save();

    let transaction = null;

    // 2️⃣ Refund wallet if used
    if (order.isWalletSelected) {
      const amount = Number(order.amount) || 0;

      // Create refund transaction
      transaction = await transactionModel.create({
        userId: order.userId,
        orderId: order._id,
        transactionType: "credit",
        amount,
        category: "refund",
        narration: `Order ${order.orderId} cancelled - refund to wallet`,
      });

      // Update user wallet (balance + cashback points)
      const updatedUser = await userModel.findByIdAndUpdate(
        order.userId,
        {
          $inc: {
            "walletDetails.balance": amount,
            "walletDetails.cashbackPoints": amount, // you can change logic if needed
          },
        },
        { new: true }
      );

      if (!updatedUser) {
        return res.status(400).send({
          msg: "Order cancelled but refund update failed",
          data: null,
        });
      }
    }

    // 3️⃣ Final response
    return res.status(200).send({
      msg: order.isWalletSelected
        ? "Order cancelled and amount refunded to user wallet"
        : "Order cancelled successfully",
      data: { orderId: order._id },
    });
  } catch (error) {
    console.error("❌ Cancel Order Error:", error);
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

    // Build dynamic match condition
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
      // 🏪 Lookup shopkeeper data
      {
        $lookup: {
          from: "users",
          localField: "shopkeeperId",
          foreignField: "_id",
          as: "shopkeeper",
        },
      },
      { $unwind: "$shopkeeper" },

      // 🧑 Lookup user data
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },

      // 🏢 Lookup business info
      {
        $lookup: {
          from: "businesses",
          localField: "businessId",
          foreignField: "_id",
          as: "business",
        },
      },
      { $unwind: { path: "$business", preserveNullAndEmptyArrays: true } },

      // 📅 Add readable date formats
      {
        $addFields: {
          monthYear: {
            $concat: [
              {
                $dateToString: {
                  format: "%B",
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
          formattedDate: {
            $dateToString: {
              format: "%d %b %Y",
              date: "$createdAt",
            },
          },
        },
      },

      { $sort: { createdAt: -1 } },

      // 📦 Group orders by month
      {
        $group: {
          _id: "$monthYear",
          orders: {
            $push: {
              id: "$_id",
              date: "$formattedDate",
              amount: "$amount",
              status: "$status",
              businessName: "$business.businessName",

              // 👤 User info
              user: {
                id: "$user._id",
                name: {
                  $concat: ["$user.firstName", " ", "$user.lastName"],
                },
                image: "$user.imageUrl",
                mobile: "$user.mobile",
              },

              // 🏪 Shopkeeper info
              shopkeeper: {
                id: "$shopkeeper._id",
                name: {
                  $concat: [
                    "$shopkeeper.firstName",
                    " ",
                    "$shopkeeper.lastName",
                  ],
                },
                image: "$shopkeeper.imageUrl",
                mobile: "$shopkeeper.mobile",
              },
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
