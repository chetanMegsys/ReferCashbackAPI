const { mongoose } = require("mongoose");
const orderModel = require("../models/orderModel");
const userModel = require("../models/userModel");
const businessModel = require("../models/businessModel");
const transactionModel = require("../models/transactionModel");
const calculateCashbackHelper = require("../CommanFuntion/calculateCashbackHelper");
const {
  isUserExists,
  isBusinessExists,
  businessDetails,
  isUserIdExists,
} = require("../CommanFuntion/commonQueries/commonQuerries");
const { paginateArray } = require("../CommanFuntion/Pagination");
const { formatTo12Hour } = require("../CommanFuntion/convertTo12hours");

const getWalletDetails = async (userId) => {
  const user = await userModel
    .findById(userId)
    .select(
      "walletDetails.balance walletDetails.cashbackPoints walletDetails.referralPoints",
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

const getOrders = async (req, res) => {
  const { shopkeeperId, orderId, status } = req.body;

  try {
    let query = {};

    if (shopkeeperId && orderId) {
      query.shopkeeperId = shopkeeperId;
      query.orderId = orderId;
    } else if (shopkeeperId) {
      query.shopkeeperId = shopkeeperId;
      query.status = status || "Pending";
    }

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
    const shopkeeperWallateDetails = await getWalletDetails(shopkeeperId);

    const isBusinessExist = await isBusinessExists(businessId);

    if (!isBusinessExist) {
      return res.status(400).send({
        msg: "This business is not available",
      });
    }
    const isCustomerExists = await isUserIdExists(userId, "customer");

    if (!isCustomerExists) {
      return res.status(400).send({
        msg: "This customer is not available",
      });
    }

    const isShopkeeperExists = await isUserExists(shopkeeperId, "shopkeeper");

    if (!isShopkeeperExists) {
      return res.status(400).send({
        msg: "This shopkeeper is not available",
      });
    }

    if (shopkeeperId === userId) {
      return res
        .status(400)
        .send({ msg: "You cannot create an order for your own shop." });
    }

    const businessDetail = await businessDetails(businessId);

    if (businessDetail.shopkeeperId != shopkeeperId) {
      return res.status(400).send({
        msg: "This business not belongs to the shopkeeper you have selected",
      });
    }

    if (isWalletSelected) {
      const walletDetails = await getWalletDetails(userId);

      if (walletDetails.balance < amount) {
        return res.status(400).send({ msg: "Insufficient reward points " });
      }
    }

    //creating order
    // 🔹 Calculate cashback summary (only summary stored)
    const { cashbackSummary } = await calculateCashbackHelper({
      userId,
      shopkeeperId,
      orderAmount: amount,
    });

    // if (shopkeeperWallateDetails.balance < cashbackSummary?.totalCashback) {
    //   return res.status(400).send({
    //     msg: "No reward points balance available at the merchant side",
    //   });
    // }

    const newOrder = new orderModel({
      userId,
      shopkeeperId,
      businessId,
      amount,
      isWalletSelected,
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
        { new: true },
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

const updateUserWallet = async (
  userId,
  amount,
  type = "referral",
  alsoAddBalance = false,
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
    const order = await orderModel.findOne({ _id: id, status: "Pending" });

    if (!order)
      return res
        .status(404)
        .send({ msg: "Order not found or already accepted" });

    // 🔹 Check that this user is the correct shopkeeper
    if (order.shopkeeperId.toString() !== userId.toString()) {
      return res.status(403).send({
        msg: "Unauthorized: This order does not belong to the logged-in shopkeeper",
      });
    }
    const user = await userModel
      .findById(order?.userId)
      .select("firstName lastName");

    const userName = user
      ? `${user.firstName} ${
          user.lastName ? user.lastName.charAt(0).toUpperCase() : ""
        }`
      : "";

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
      const shopkeeperWallateDetails = await getWalletDetails(
        order.shopkeeperId,
      );
      if (shopkeeperWallateDetails.balance < cashbackSummary?.totalCashback) {
        return res.status(400).json({
          msg: "You are not eligible to accept this order due to insufficient reward points balance.",
        });
      }
      const allTransactions = [];

      await allTransactions.push({
        userId: order?.shopkeeperId,
        transactionType: "debit",
        orderId: order._id,
        amount: cashbackSummary?.totalCashback,
        category: "cashback",
        narration: `Cashback deduction for order ${order?.orderId}`,
      });

      const amount = cashbackSummary?.totalCashback;

      await userModel.findByIdAndUpdate(
        order?.shopkeeperId,
        { $inc: { "walletDetails.balance": -amount } }, // decrement balance
        { new: true },
      );
      // --------------------------
      // Cashback distribution
      // --------------------------

      // 🔹 Customer cashback
      if (cashbackReceivers.customer?.cashback > 0) {
        await updateUserWallet(
          cashbackReceivers.customer.userId,
          cashbackReceivers.customer.cashback,
          "customer",
          true,
        );
        allTransactions.push({
          userId: cashbackReceivers?.customer?.userId,
          transactionType: "credit",
          orderId: order?._id,
          amount: cashbackReceivers?.customer?.cashback,
          category: "cashback",
          narration: "Cashback received",
        });
      }

      // 🔹 Referrer cashback
      if (cashbackReceivers.referrer?.cashback > 0) {
        await updateUserWallet(
          cashbackReceivers.referrer.userId,
          cashbackReceivers.referrer.cashback,
          "referral",
          true,
        );
        allTransactions.push({
          userId: cashbackReceivers.referrer.userId,
          transactionType: "credit",
          orderId: order._id,
          amount: cashbackReceivers.referrer.cashback,
          category: "reward",
          narration: `${userName} reward points`,
        });
      }

      // 🔹 Multi-level cashback: LEVELS, IROT-1, IROT-2
      const multiLevelGroups = [
        {
          group: cashbackReceivers.levels,
          type: "loyalty points",
          category: "loyaltyRewards",
        },
        {
          group: cashbackReceivers.irot1,
          type: "experience points-1",
          category: "experiencePoint1",
        },
        {
          group: cashbackReceivers.irot2,
          type: "experience points 2",
          category: "experiencePoint2",
        },
      ];

      for (const { group, type, category } of multiLevelGroups) {
        if (Array.isArray(group)) {
          for (const entry of group) {
            if (!entry) continue;
            await updateUserWallet(
              entry.userId,
              entry.cashback,
              "referral",
              true,
            );
            allTransactions.push({
              userId: entry.userId,
              transactionType: "credit",
              orderId: order._id,
              amount: entry.cashback,
              category: category,
              narration: `${userName} ${type} `,
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
          true,
        );
        allTransactions.push({
          userId: cashbackReceivers.ror.receiver.userId,
          transactionType: "credit",
          orderId: order._id,
          amount: cashbackReceivers.ror.receiver.cashback,
          category: "RORP",
          narration: `${userName} RORP cashback`,
        });
      }
      if (order?.isWalletSelected) {
        let creditAmount = order.amount || 0;
        // 1️⃣ Refund to wallet
        await updateUserWallet(
          order.shopkeeperId,
          creditAmount,
          "customer",
          true,
        );

        // 2️⃣ Log refund transaction
        await allTransactions.push({
          userId: order.shopkeeperId,
          transactionType: "credit",
          orderId: order._id,
          amount: creditAmount,
          category: "order",
          narration: `Order ${order.orderId} amount credited after deduction`,
        });
      }
      // 🔹 Shopkeeper cashback (separate entry)
      if (cashbackReceivers.shopkeeper?.cashback > 0) {
        await updateUserWallet(
          cashbackReceivers.shopkeeper.userId,
          cashbackReceivers.shopkeeper.cashback,
          "referral",
          true,
        );
        allTransactions.push({
          userId: cashbackReceivers.shopkeeper.userId,
          transactionType: "credit",
          orderId: order._id,
          amount: cashbackReceivers.shopkeeper.cashback,
          category: "tieUp",
          narration: `${userName} Tie up income`,
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
            true,
          );
          allTransactions.push({
            userId: admin.userId,
            transactionType: "credit",
            orderId: order._id,
            amount: admin.cashback,
            category: "companyProfit",
            narration: `${userName} SuperAdmin cashback`,
          });
        }
      }
      // 🔹 Admin cashback
      if (
        Array.isArray(cashbackReceivers.admin) &&
        cashbackReceivers.admin.length > 0
      ) {
        for (const admin of cashbackReceivers.admin) {
          await updateUserWallet(
            admin.userId,
            admin.cashback,
            "referral",
            true,
          );
          allTransactions.push({
            userId: admin.userId,
            transactionType: "credit",
            orderId: order._id,
            amount: admin.cashback,
            category: "adminCharge",
            narration: `${userName} admin charges`,
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
        await updateUserWallet(order.userId, amount, "customer", true);

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
          msg: "Order rejected and reward points refund processed successfully",
        });
      }

      // If order was NOT paid by wallet → no refund needed
      return res.status(200).send({
        msg: "Order rejected successfully ",
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
        narration: `Order ${order.orderId} cancelled - reward points refunded`,
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
        { new: true },
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

const getOrdersByMonth = async (req, res) => {
  try {
    const { userId, shopkeeperId } = req.body;

    if (!userId && !shopkeeperId) {
      return res.status(400).send({ msg: "userId or shopkeeperId required" });
    }

    // Build dynamic match condition
    let matchCondition = {};
    if (userId) {
      matchCondition.userId = new mongoose.Types.ObjectId(userId);
    }
    if (shopkeeperId) {
      matchCondition = {
        $or: [
          { shopkeeperId: new mongoose.Types.ObjectId(shopkeeperId) },
          { userId: new mongoose.Types.ObjectId(shopkeeperId) },
        ],
      };
    }

    // const result = await orderModel.aggregate([
    //   {
    //     $match: matchCondition,
    //   },
    //   // 🏪 Lookup shopkeeper data
    //   {
    //     $lookup: {
    //       from: "users",
    //       localField: "shopkeeperId",
    //       foreignField: "_id",
    //       as: "shopkeeper",
    //     },
    //   },
    //   { $unwind: "$shopkeeper" },

    //   // 🧑 Lookup user data
    //   {
    //     $lookup: {
    //       from: "users",
    //       localField: "userId",
    //       foreignField: "_id",
    //       as: "user",
    //     },
    //   },
    //   { $unwind: "$user" },

    //   // 🏢 Lookup business info
    //   {
    //     $lookup: {
    //       from: "businesses",
    //       localField: "businessId",
    //       foreignField: "_id",
    //       as: "business",
    //     },
    //   },
    //   { $unwind: { path: "$business", preserveNullAndEmptyArrays: true } },

    //   // 📅 Add readable date formats
    //   {
    //     $addFields: {
    //       year: { $year: "$createdAt" },
    //       monthYear: {
    //         $concat: [
    //           {
    //             $dateToString: {
    //               format: "%B",
    //               date: "$createdAt",
    //             },
    //           },
    //           " ’",
    //           {
    //             $substr: [
    //               { $dateToString: { format: "%Y", date: "$createdAt" } },
    //               2,
    //               2,
    //             ],
    //           },
    //         ],
    //       },
    //       formattedDate: {
    //         $dateToString: {
    //           format: "%d %b %Y",
    //           date: "$createdAt",
    //         },
    //       },
    //     },
    //   },

    //   { $sort: { createdAt: -1 } },

    //   // 📦 Group orders by month
    //   {
    //     $group: {
    //       _id: "$monthYear",
    //       orders: {
    //         $push: {
    //           id: "$_id",
    //           date: "$formattedDate",
    //           amount: "$amount",
    //           status: "$status",
    //           isWalletSelected: "$isWalletSelected",
    //           businessName: "$business.businessName",

    //           // 👤 User info
    //           user: {
    //             id: "$user._id",
    //             name: {
    //               $concat: ["$user.firstName", " ", "$user.lastName"],
    //             },
    //             image: "$user.imageUrl",
    //             mobile: "$user.mobile",
    //           },

    //           // 🏪 Shopkeeper info
    //           shopkeeper: {
    //             id: "$shopkeeper._id",
    //             name: {
    //               $concat: [
    //                 "$shopkeeper.firstName",
    //                 " ",
    //                 "$shopkeeper.lastName",
    //               ],
    //             },
    //             image: "$shopkeeper.imageUrl",
    //             mobile: "$shopkeeper.mobile",
    //           },
    //         },
    //       },
    //     },
    //   },

    //   {
    //     $project: {
    //       month: "$_id",
    //       year: "$_id.year",
    //       orders: 1,
    //       _id: 0,
    //     },
    //   },
    //   { $sort: { month: 1, year: 1 } },
    // ]);

    const result = await orderModel.aggregate([
      // 🔍 Match conditions
      {
        $match: matchCondition,
      },

      // 🏪 Lookup shopkeeper
      {
        $lookup: {
          from: "users",
          localField: "shopkeeperId",
          foreignField: "_id",
          as: "shopkeeper",
        },
      },
      { $unwind: "$shopkeeper" },

      // 👤 Lookup user
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },

      // 🏢 Lookup business
      {
        $lookup: {
          from: "businesses",
          localField: "businessId",
          foreignField: "_id",
          as: "business",
        },
      },
      { $unwind: { path: "$business", preserveNullAndEmptyArrays: true } },

      // 📅 Add date fields (numeric + display)
      {
        $addFields: {
          year: { $year: "$createdAt" },
          monthNumber: { $month: "$createdAt" },

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

      // 🔽 Sort orders inside each month (latest first)
      {
        $sort: { createdAt: -1 },
      },

      // 📦 Group by year + month
      {
        $group: {
          _id: {
            year: "$year",
            month: "$monthNumber",
            label: "$monthYear",
          },
          orders: {
            $push: {
              id: "$_id",
              date: "$formattedDate",
              amount: "$amount",
              status: "$status",
              isWalletSelected: "$isWalletSelected",
              businessName: "$business.businessName",

              // 👤 User info
              user: {
                id: "$user._id",
                name: { $concat: ["$user.firstName", " ", "$user.lastName"] },
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

      // 🎯 Final shape
      {
        $project: {
          _id: 0,
          month: "$_id.label",
          year: "$_id.year",
          monthNumber: "$_id.month",
          orders: 1,
        },
      },

      // 📊 Sort months correctly (Year → Month)
      {
        $sort: {
          year: -1,
          monthNumber: -1,
        },
      },
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
    if (result) {
      if (typeof result === "string") {
        return res.status(404).json({ message: result });
      }
    }
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ message: "Server error" });
  }
};

const graph = async (req, res) => {
  try {
    const now = new Date();

    const start = new Date(now);
    start.setMonth(start.getMonth() - 1);
    start.setDate(1);
    start.setMonth(start.getMonth() - 11);
    const result = await orderModel.aggregate([
      {
        $match: {
          createdAt: { $gte: start, $lte: now },
          status: "Accepted",
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          totalAmount: { $sum: "$amount" },
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 },
      },
    ]);
    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    let xAxisdata = [];
    let seriesLineData = [];

    let current = new Date(start);
    for (let i = 0; i < 12; i++) {
      const m = current.getMonth();
      const y = current.getFullYear();

      xAxisdata.push(`${monthNames[m]}-${y}`);

      const found = result.find(
        (item) => item._id.month === m + 1 && item._id.year === y,
      );

      seriesLineData.push(found ? found.totalAmount : 0);

      current.setMonth(current.getMonth() + 1);
    }
    return res.status(200).json({
      monthWiseAmount: {
        xAxisdata,
        seriesLineData,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
};

const getOrdersForAdmin = async (req, res) => {
  const { orderId, pageNumber, pageLimit, isPagination, searchText } = req.body;

  let matchStage = { status: "Accepted" };

  if (orderId) {
    matchStage._id = orderId;
  }

  try {
    const ordersData = await orderModel.aggregate([
      {
        $match: {
          ...matchStage,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "customerDetails",
        },
      },
      {
        $unwind: { path: "$customerDetails", preserveNullAndEmptyArrays: true },
      },
      {
        $lookup: {
          from: "users",
          localField: "shopkeeperId",
          foreignField: "_id",
          as: "shopkeeperDetails",
        },
      },
      {
        $unwind: {
          path: "$shopkeeperDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "businesses",
          localField: "businessId",
          foreignField: "_id",
          as: "businessDetails",
        },
      },
      {
        $unwind: { path: "$businessDetails", preserveNullAndEmptyArrays: true },
      },
      {
        $project: {
          _id: 1,
          amount: 1, // order.amount
          "businessDetails.businessName": 1,
          "shopkeeperDetails.firstName": 1,
          "shopkeeperDetails.middleName": 1,
          "shopkeeperDetails.lastName": 1,
          "customerDetails.firstName": 1,
          "customerDetails.middleName": 1,
          "customerDetails.lastName": 1,
          createdAt: 1,
          isWalletSelected: 1,
          orderId: 1,
          status: 1,
        },
      },
      {
        $sort: {
          createdAt: -1,
        },
      },
    ]);
    if (!ordersData || ordersData.length === 0) {
      return res.status(404).send({ msg: "No orders present" });
    }

    const paginated = paginateArray({
      data: ordersData,
      page: pageNumber,
      limit: pageLimit,
      isPagination,
      search: searchText,
      searchKeys: ["amount", "status", "isWalletSelected", "orderId"],
    });

    const startIndex =
      isPagination && pageNumber && pageLimit
        ? (pageNumber - 1) * pageLimit
        : 0;

    const paginatedWithFormattedDate = {
      ...paginated,
      data: paginated.data.map((item, index) => {
        const formatted = {
          srNo: startIndex + index + 1, // 👈 serial number
          ...item,
          formattedDate: formatTo12Hour(item.createdAt),
        };
        delete formatted.createdAt;
        return formatted;
      }),
    };

    return res.status(200).send({
      msg: "Orders fetched successfully",
      data: paginatedWithFormattedDate,
    });
  } catch (error) {
    return res.status(500).send({ msg: error.message });
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
  graph,
  getOrdersForAdmin,
};
