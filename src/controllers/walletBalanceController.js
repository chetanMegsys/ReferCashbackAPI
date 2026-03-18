const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");
const walletBalanceModel = require("../models/walletBalanceModel");
const userModel = require("./../models/userModel");
const transactionModel = require("./../models/transactionModel");
const { paginateArray } = require("../CommanFuntion/Pagination");
const { formatTo12Hour } = require("../CommanFuntion/convertTo12hours");
const PaymentMethodModel = require("../models/PaymentMethodModel");
const {
  isUserIdExists,
} = require("../CommanFuntion/commonQueries/commonQuerries");
const depositModel = require("../models/depositModel");

// const withdrawRequest = async (req, res) => {
//   try {
//     const { userId, amount } = req.body;
//     if (!userId) {
//       return res.status(400).json({ msg: "UserId is required" });
//     }

//     if (!amount || amount <= 0) {
//       return res.status(400).json({ msg: "Valid amount is required" });
//     }

//     if (!mongoose.Types.ObjectId.isValid(userId)) {
//       return res.status(400).json({ msg: "Invalid userId format" });
//     }

//     const userExists = await userModel.findOne({
//       _id: userId,
//       status: "active",
//     });
//     if (!userExists) {
//       return res.status(404).json({ msg: "User does not exist" });
//     }

//     const existingRequest = await walletBalanceModel.findOne({
//       userId,
//       status: "pending",
//     });

//     if (existingRequest) {
//       return res.status(400).json({ msg: "Withdraw request already pending" });
//     }

//     const newWithdrawRequest = await walletBalanceModel.create({
//       userId,
//       amount,
//     });

//     return res.status(201).json({
//       msg: "Withdraw request created successfully",
//       data: newWithdrawRequest,
//     });
//   } catch (error) {
//     console.error("❌ Withdraw Request Error:", error);
//     return res.status(500).json({
//       msg: "Internal server error",
//     });
//   }
// };
let cachedAdmin = null;
const getActiveAdmin = async () => {
  if (!cachedAdmin) {
    cachedAdmin = await userModel.findOne({
      role: "admin",
      status: "active",
    });
  }
  return cachedAdmin;
};

const withdrawRequest = async (req, res) => {
  try {
    const { userId, amount } = req.body;

    if (!userId) {
      return res.status(400).json({ msg: "UserId is required" });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ msg: "Valid amount is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ msg: "Invalid userId format" });
    }

    const userExists = await userModel.findOne({
      _id: userId,
      status: "active",
    });
    if (!userExists) {
      return res.status(404).json({ msg: "User does not exist" });
    }

    // Get current timestamp
    const now = new Date();

    // Check if a pending withdraw request already exists
    let existingRequest = await walletBalanceModel.findOne({
      userId,
      status: "pending",
    });

    if (existingRequest) {
      // Add new amount to existing pending request
      existingRequest.amount += amount;

      // Add new entry in history
      existingRequest.history.push({
        amount,
        requestedOn: now,
      });

      await existingRequest.save();

      return res.status(200).json({
        msg: "Withdraw request updated successfully",
        data: existingRequest,
      });
    } else {
      // Create a new withdraw request with history
      const newWithdrawRequest = await walletBalanceModel.create({
        userId,
        amount,
        history: [
          {
            amount,
            requestedOn: now,
          },
        ],
      });

      return res.status(201).json({
        msg: "Withdraw request created successfully",
        data: newWithdrawRequest,
      });
    }
  } catch (error) {
    console.error("❌ Withdraw Request Error:", error);
    return res.status(500).json({
      msg: "Internal server error",
    });
  }
};

const addWalletBalance = async (req, res) => {
  try {
    const { userId, amount } = req.body;
    if (!userId) {
      return res.status(400).json({ msg: "UserId is required" });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ msg: "Valid amount is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ msg: "Invalid userId format" });
    }
    const adminUser = await getActiveAdmin();
    const userExists = await userModel
      .findOne({
        _id: userId,
        status: "active",
      })
      .select("-password -refreshToken");
    if (!userExists) {
      return res.status(404).json({ msg: "User does not exist" });
    }

    userExists.walletDetails.balance += Number(amount);
    adminUser.walletDetails.balance -= Number(amount);
    adminUser.walletDetails.depositRequest += Number(amount);
    await userExists.save();
    await adminUser.save();

    const transactions = await transactionModel.insertMany([
      {
        userId: userId,
        transactionType: "credit",
        orderId: null,
        amount,
        category: "adminCredit",
        narration: "Amount credited by admin",
      },
      {
        userId: adminUser._id,
        transactionType: "debit",
        orderId: null,
        amount,
        category: "adminCredit",
        narration: `Amount credited to ${userExists.firstName} ${userExists.lastName}`,
      },
    ]);

    if (!transactions) {
      return res
        .status(500)
        .json({ msg: "Failed to create transaction record" });
    }

    return res.status(200).json({
      msg: "reward points updated successfully",
      data: userExists.walletDetails.balance,
    });
  } catch (error) {
    return res.status(500).json({
      msg: "Internal server error",
      error: error.message,
    });
  }
};

const getWithdrawRequests = async (req, res) => {
  try {
    const {
      userId,
      withdrawId,
      pageNumber,
      pageLimit,
      isPagination,
      searchText,
    } = req.body;

    if (!withdrawId) {
      if (userId) {
        // 1️⃣ Validate ObjectId format first
        if (!mongoose.Types.ObjectId.isValid(userId)) {
          return res.status(400).json({ msg: "Invalid userId" });
        }

        // 2️⃣ Check if user exists in DB
        const userExists = await isUserIdExists(userId);
        if (!userExists) {
          return res.status(404).json({ msg: "User does not exist" });
        }
      }
      let matchStage = {};

      const isValidUserId =
        userId &&
        userId !== "" &&
        userId !== "null" &&
        userId !== "undefined" &&
        mongoose.Types.ObjectId.isValid(userId);

      if (isValidUserId) {
        matchStage.userId = new mongoose.Types.ObjectId(userId);
      }

      const allRequests = await walletBalanceModel.aggregate([
        {
          $match: matchStage, // 👈 IMPORTANT (filter by userId)
        },
        {
          $addFields: {
            statusOrder: {
              $switch: {
                branches: [
                  { case: { $eq: ["$status", "pending"] }, then: 1 },
                  { case: { $eq: ["$status", "approved"] }, then: 2 },
                  { case: { $eq: ["$status", "rejected"] }, then: 3 },
                  { case: { $eq: ["$status", "cancelled"] }, then: 4 },
                ],
                default: 4,
              },
            },
          },
        },
        {
          $sort: {
            statusOrder: 1,
          },
        },
        {
          $lookup: {
            from: "users", // collection name
            localField: "userId",
            foreignField: "_id",
            as: "userDetails",
          },
        },
        {
          $unwind: {
            path: "$userDetails",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "paymentmethods", // check actual collection name
            localField: "paymentMethodId",
            foreignField: "_id",
            as: "paymentMethodDetails",
          },
        },
        {
          $unwind: {
            path: "$paymentMethodDetails",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            statusOrder: 0,
            updatedAt: 0,
            __v: 0,
            paymentMethodId: 0,
            "userDetails.password": 0,
            "userDetails.__v": 0,
            "userDetails.refreshToken": 0,
            "userDetails.walletDetails": 0,
            "userDetails.createdAt": 0,
            "userDetails.updatedAt": 0,
            "userDetails.referalUser": 0,
            "userDetails.deviceDetails": 0,

            "paymentMethodDetails.__v": 0,
            "paymentMethodDetails.createdAt": 0,
            "paymentMethodDetails.updatedAt": 0,
          },
        },
      ]);

      if (!allRequests || allRequests.length === 0) {
        return res.status(404).json({ msg: "No withdraw requests found" });
      }

      const paginated = paginateArray({
        data: allRequests,
        page: pageNumber,
        limit: pageLimit,
        isPagination,
        search: searchText,
        searchKeys: [
          "amount",
          "status",
          "rejectResponse",
          "mobile",
          "userDetails.firstName",
          "userDetails.lastName",
          "businessDetails.businessName",
          "paymentMethodDetails.name",
        ],
      });

      const paginatedWithFormattedDate = {
        ...paginated,
        data: paginated.data.map((item) => {
          const formatted = {
            ...item,
            formattedDate: formatTo12Hour(item.createdAt),
          };
          return formatted;
        }),
      };

      return res.status(200).json({
        msg: "All Withdraw requests retrieved successfully",
        data: paginatedWithFormattedDate,
      });
    } else {
      if (!mongoose.Types.ObjectId.isValid(withdrawId)) {
        return res.status(400).json({ msg: "Invalid withdrawId format" });
      }
      const request = await walletBalanceModel
        .findById(withdrawId)
        .select("-updatedAt -__v")
        .populate({
          path: "userId",
          select:
            "-password -refreshToken -__v -walletDetails -updatedAt -referalUser -createdAt -deviceDetails",
        })
        .populate({
          path: "paymentMethodId",
          select: "-__v -updatedAt -createdAt",
        });

      if (!request) {
        return res.status(404).json({ msg: "Withdraw request not found" });
      }

      const requestObj = request.toObject();

      requestObj.formattedDate = formatTo12Hour(requestObj.createdAt);

      delete requestObj.createdAt;

      return res.status(200).json({
        msg: "Withdraw request retrieved successfully",
        data: requestObj,
      });
    }
  } catch (error) {
    console.error("❌ Get Withdraw Requests Error:", error);
    return res.status(500).json({
      msg: "Internal server error",
    });
  }
};

const approveRejecteWithdrawRequest = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { withdrawId, action, utrNo, rejectResponse, paymentMethodId } =
      req.body;
    if (!withdrawId) {
      return res.status(500).json({ msg: "withdrawId is required" });
    }
    if (!action || !["approve", "reject", "cancelled"].includes(action)) {
      return res.status(500).json({ msg: "Valid action is required" });
    }
    if (!mongoose.Types.ObjectId.isValid(withdrawId)) {
      return res.status(500).json({ msg: "Invalid withdrawId format" });
    }
    const withdrawRequest = await walletBalanceModel
      .findOne({
        _id: withdrawId,
        status: "pending",
      })
      .session(session);
    const minimumBalance = process.env.MINBALANCE;
    if (!withdrawRequest) {
      return res
        .status(404)
        .json({ msg: `Withdraw request not found to ${action}` });
    }
    const adminUser = await getActiveAdmin();
    const user = await userModel
      .findOne({
        _id: withdrawRequest.userId,
        status: "active",
      })
      .session(session);

    if (!user) {
      return res.status(400).json({ msg: "User not found" });
    }

    let actionText = "";
    if (action === "approve") {
      if (
        !paymentMethodId ||
        !mongoose.Types.ObjectId.isValid(paymentMethodId)
      ) {
        return res.status(400).json({
          success: false,
          message: "Valid payment method is required",
        });
      }

      const paymentMethodIdExist = await PaymentMethodModel.findOne({
        _id: paymentMethodId,
        status: "Active", // make sure case matches schema enum
      }).session(session);
      if (!paymentMethodIdExist) {
        return res.status(404).json({
          success: false,
          message: "Payment method not found or inactive",
        });
      }

      if (utrNo === "" || !utrNo) {
        return res
          .status(400)
          .json({ msg: "UTR number is required for approval" });
      }
      if (
        user.walletDetails.balance - withdrawRequest.amount <
        minimumBalance
      ) {
        return res.status(400).json({ msg: "Insufficient reward points" });
      }
      withdrawRequest.status = "approved";
      withdrawRequest.utrNo = utrNo || null;
      withdrawRequest.paymentMethodId = paymentMethodId;
      actionText = "approved";
    } else if (action === "reject") {
      if (!rejectResponse || rejectResponse.trim() === "") {
        return res.status(400).json({ msg: "Reject reason is required" });
      }

      withdrawRequest.rejectResponse = rejectResponse.trim();
      withdrawRequest.status = "rejected";
      actionText = "rejected";
    } else if (action === "cancelled") {
      withdrawRequest.status = "cancelled";
      actionText = "cancelled";
    }

    const savedRequest = await withdrawRequest.save({ session });

    if (savedRequest && action === "approve") {
      const userUpdate = await userModel.updateOne(
        {
          _id: user._id,
          "walletDetails.balance": {
            $gte: savedRequest.amount,
          },
        },
        {
          $inc: {
            "walletDetails.balance": -savedRequest.amount,
          },
        },
        { session },
      );

      if (userUpdate.modifiedCount === 0) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          msg: "Insufficient reward points",
        });
      }

      // 💰 Add to admin
      await userModel.updateOne(
        { _id: adminUser._id },
        {
          $inc: {
            "walletDetails.balance": savedRequest.amount,
            "walletDetails.withdrawRequest": savedRequest.amount,
          },
        },
        { session },
      );

      const transactions = await transactionModel.insertMany(
        [
          {
            userId: savedRequest.userId,
            transactionType: "debit",
            orderId: null,
            amount: savedRequest.amount,
            requestId: savedRequest._id,
            category: "withdrawalRequest",
            narration: "Withdrawal request approved",
          },
          {
            userId: adminUser._id,
            transactionType: "credit",
            orderId: null,
            amount: savedRequest.amount,
            requestId: savedRequest._id,
            category: "withdrawalRequest",
            narration: `Withdrawal request approved - ${user.firstName} ${user.lastName}`,
          },
        ],
        { session },
      );

      if (!transactions) {
        return res
          .status(400)
          .json({ msg: "Failed to create transaction record" });
      }
    }
    await session.commitTransaction();
    session.endSession();
    return res.status(200).json({
      msg: `Withdraw request ${actionText} successfully`,
      data: withdrawRequest,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("❌ Approve/Reject Withdraw Request Error:", error);
    return res.status(500).json({
      msg: "Internal server error",
    });
  }
};

const deductWalletBalance = async (req, res) => {
  try {
    const DEDUCT_AMOUNT = Number(process.env.DEDUCT_AMOUNT || 10);

    const users = await userModel.find({
      status: "active",
      role: { $in: ["shopkeeper", "customer"] },
    });

    if (!users || users.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No active users found",
      });
    }

    const bulkOps = [];
    const transactions = [];
    let totalDeductedAmount = 0; // 🔹 Track total deducted

    for (const user of users) {
      const totalDeduction =
        DEDUCT_AMOUNT + (user.walletDetails.nextMonthDeduction || 0);
      let actualDeducted = 0;

      if (user.walletDetails.balance >= totalDeduction) {
        user.walletDetails.balance -= totalDeduction;
        user.walletDetails.nextMonthDeduction = 0;
        actualDeducted = totalDeduction;
      } else {
        actualDeducted = user.walletDetails.balance;
        user.walletDetails.nextMonthDeduction =
          totalDeduction - user.walletDetails.balance;
        user.walletDetails.balance = 0;
      }

      // 🔹 Add to total deducted for admin
      totalDeductedAmount += actualDeducted;

      bulkOps.push({
        updateOne: {
          filter: { _id: user._id },
          update: {
            $set: {
              "walletDetails.balance": user.walletDetails.balance,
              "walletDetails.nextMonthDeduction":
                user.walletDetails.nextMonthDeduction,
            },
          },
        },
      });

      // prepare transaction entry for this user
      if (actualDeducted > 0) {
        transactions.push({
          userId: user._id,
          transactionType: "debit",
          orderId: null,
          amount: actualDeducted,
          category: "monthlyDeduction",
          narration: "Amount deducted as monthly maintenance fee",
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    if (bulkOps.length > 0) {
      // update wallets
      const result = await userModel.bulkWrite(bulkOps);

      // create transactions
      if (transactions.length > 0) {
        await transactionModel.insertMany(transactions);
      }

      // 🔹 Add totalDeductedAmount to admin monthlyIncome
      const adminUser = await userModel.findOne({
        role: "admin",
        status: "active",
      });
      if (adminUser) {
        await userModel.findByIdAndUpdate(
          adminUser._id,
          {
            $inc: {
              "walletDetails.monthlyIncome": totalDeductedAmount,
              "walletDetails.balance": totalDeductedAmount,
            },
          },
          { new: true },
        );

        // Optionally, log a transaction for admin income
        await transactionModel.create({
          userId: adminUser._id,
          transactionType: "credit",
          orderId: null,
          amount: totalDeductedAmount,
          category: "monthlyDeduction",
          narration: "Monthly deduction collected from all users",
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      return res.status(200).json({
        success: true,
        message: "Deducted successfully and added to admin monthlyIncome",
        modifiedCount: result.modifiedCount,
        totalDeductedAmount,
      });
    }

    res.status(200).json({
      success: true,
      message: "No users to deduct",
    });
  } catch (error) {
    console.error("Wallet deduction error:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }
};

const createDepositRequest = async (req, res) => {
  try {
    const { userId, Amount, paymentMethodId } = req.body;
    const proofDoc = req?.files?.proofDoc || null;

    // ✅ Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).send({
        status: false,
        msg: "Invalid userId",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(paymentMethodId)) {
      return res.status(400).send({
        status: false,
        msg: "Invalid paymentMethodId",
      });
    }

    // ✅ User check
    const userData = await userModel
      .findOne({ _id: userId, status: "active" })
      .select("firstName lastName role walletDetails status mobile");

    if (!userData) {
      return res.status(404).send({
        status: false,
        msg: "User not found",
      });
    }

    // ✅ Amount validation
    const amountValue = Number(Amount);
    if (isNaN(amountValue) || amountValue <= 0) {
      return res.status(400).send({
        status: false,
        msg: "Amount must be greater than 0",
      });
    }

    // ✅ Payment method check
    const paymentMethodIdExist =
      await PaymentMethodModel.findById(paymentMethodId);
    if (!paymentMethodIdExist) {
      return res.status(404).send({
        status: false,
        msg: "Payment method not found",
      });
    }

    let proofDocUrl = null; // ✅ Default null

    // ==============================
    // ✅ FILE VALIDATION ONLY IF EXISTS
    // ==============================
    if (proofDoc) {
      const allowedExtensions = [
        ".jpg",
        ".jpeg",
        ".png",
        ".heif",
        ".heic",
        ".pdf",
      ];
      const fileExt = path.extname(proofDoc.name).toLowerCase();

      if (!allowedExtensions.includes(fileExt)) {
        return res.status(400).send({
          status: false,
          msg: `Invalid file type. Allowed formats: ${allowedExtensions.join(", ")}`,
        });
      }

      // ✅ File size validation (5MB)
      const MAX_SIZE = 5 * 1024 * 1024;
      if (proofDoc.size > MAX_SIZE) {
        return res.status(400).send({
          status: false,
          msg: "File size exceeds 5 MB limit",
        });
      }

      // ✅ Upload folder
      const uploadDir = "./public/images/ProofDoc/";
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      // ✅ File upload
      const fileName = `${userId}-${Date.now()}${fileExt}`;
      const filePath = path.join(uploadDir, fileName);
      proofDocUrl = `/images/ProofDoc/${fileName}`;

      await proofDoc.mv(filePath);
    }

    // ✅ Save deposit
    const deposit = await depositModel.create({
      userId,
      amount: amountValue,
      paymentMethodId,
      documentUrl: proofDocUrl, // can be null
    });

    return res.status(200).send({
      status: true,
      msg: "Deposit request created successfully",
      data: deposit,
    });
  } catch (error) {
    console.error("Deposit error:", error);
    return res.status(500).json({
      status: false,
      msg: "Something went wrong",
    });
  }
};

const getDepositRequests = async (req, res) => {
  try {
    const {
      userId,
      depositId,
      pageNumber,
      pageLimit,
      isPagination,
      searchText,
      status, // ✅ NEW (array or single)
    } = req.body;

    // ==============================
    // 🔹 SINGLE DEPOSIT FETCH
    // ==============================
    if (depositId) {
      if (!mongoose.Types.ObjectId.isValid(depositId)) {
        return res.status(400).json({ msg: "Invalid depositId format" });
      }

      const request = await depositModel.aggregate([
        {
          $match: {
            _id: new mongoose.Types.ObjectId(depositId),
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "userDetails",
          },
        },
        {
          $unwind: {
            path: "$userDetails",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "businesses",
            localField: "userId",
            foreignField: "shopkeeperId", // ✅ one-to-one
            as: "businessDetails",
          },
        },
        {
          $unwind: {
            path: "$businessDetails", // ✅ keep this
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "paymentmethods",
            localField: "paymentMethodId",
            foreignField: "_id",
            as: "paymentMethodDetails",
          },
        },
        {
          $unwind: {
            path: "$paymentMethodDetails",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            updatedAt: 0,
            __v: 0,

            "userDetails.password": 0,
            "userDetails.refreshToken": 0,
            "userDetails.__v": 0,
            "userDetails.deviceDetails": 0,
            "businessDetails.__v": 0,
            "businessDetails.createdAt": 0,
            "businessDetails.updatedAt": 0,
            "businessDetails.location": 0,

            "paymentMethodDetails.__v": 0,
            "paymentMethodDetails.createdAt": 0,
            "paymentMethodDetails.updatedAt": 0,
            "paymentMethodDetails.status": 0,
          },
        },
      ]);

      if (!request) {
        return res.status(404).json({ msg: "Deposit request not found" });
      }

      return res.status(200).json({
        msg: "Deposit request retrieved successfully",
        data: request,
      });
    }

    // ==============================
    // 🔹 VALIDATE USER
    // ==============================
    if (userId) {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ msg: "Invalid userId" });
      }

      const userExists = await isUserIdExists(userId);
      if (!userExists) {
        return res.status(404).json({ msg: "User does not exist" });
      }
    }

    // ==============================
    // 🔹 MATCH STAGE
    // ==============================
    let matchStage = {};

    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      matchStage.userId = new mongoose.Types.ObjectId(userId);
    }

    // ✅ STATUS FILTER (array or single)
    if (status) {
      if (Array.isArray(status)) {
        matchStage.status = { $in: status };
      } else {
        matchStage.status = status;
      }
    }

    // ==============================
    // 🔹 AGGREGATION
    // ==============================
    const allRequests = await depositModel.aggregate([
      {
        $match: matchStage,
      },
      {
        $addFields: {
          statusOrder: {
            $switch: {
              branches: [
                { case: { $eq: ["$status", "pending"] }, then: 1 },
                { case: { $eq: ["$status", "approved"] }, then: 2 },
                { case: { $eq: ["$status", "rejected"] }, then: 3 },
                { case: { $eq: ["$status", "cancelled"] }, then: 4 },
              ],
              default: 5,
            },
          },
        },
      },
      {
        $sort: {
          statusOrder: 1,
          createdAt: -1,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "userDetails",
        },
      },
      {
        $unwind: {
          path: "$userDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "businesses",
          localField: "userId",
          foreignField: "shopkeeperId", // ✅ one-to-one
          as: "businessDetails",
        },
      },
      {
        $unwind: {
          path: "$businessDetails", // ✅ keep this
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "paymentmethods",
          localField: "paymentMethodId",
          foreignField: "_id",
          as: "paymentMethodDetails",
        },
      },
      {
        $unwind: {
          path: "$paymentMethodDetails",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          statusOrder: 0,
          updatedAt: 0,
          __v: 0,
          paymentMethodId: 0,

          "userDetails.password": 0,
          "userDetails.__v": 0,
          "userDetails.refreshToken": 0,
          "userDetails.walletDetails": 0,
          "userDetails.createdAt": 0,
          "userDetails.updatedAt": 0,
          "userDetails.referalUser": 0,
          "userDetails.deviceDetails": 0,

          "businessDetails.__v": 0,
          "businessDetails.createdAt": 0,
          "businessDetails.updatedAt": 0,
          "businessDetails.location": 0,

          "paymentMethodDetails.__v": 0,
          "paymentMethodDetails.createdAt": 0,
          "paymentMethodDetails.updatedAt": 0,
        },
      },
    ]);

    if (!allRequests.length) {
      return res.status(404).json({ msg: "No deposit requests found" });
    }

    // ==============================
    // 🔹 PAGINATION
    // ==============================
    const paginated = paginateArray({
      data: allRequests,
      page: pageNumber,
      limit: pageLimit,
      isPagination,
      search: searchText,
      searchKeys: [
        "amount",
        "status",
        "rejectResponse",
        "mobile",
        "userDetails.firstName",
        "userDetails.lastName",
        "businessDetails.businessName",
        "paymentMethodDetails.name",
      ],
    });

    // ==============================
    // 🔹 DATE FORMAT
    // ==============================
    const formattedData = {
      ...paginated,
      data: paginated.data.map((item) => ({
        ...item,
        formattedDate: formatTo12Hour(item.createdAt),
      })),
    };

    return res.status(200).json({
      msg: "All Deposit requests retrieved successfully",
      data: formattedData,
    });
  } catch (error) {
    console.error("❌ Get Deposit Requests Error:", error);

    return res.status(500).json({
      msg: "Internal server error",
    });
  }
};

const approveRejecteDepositRequest = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { depositId, action, rejectResponse } = req.body;
    if (!depositId) {
      return res.status(500).json({ msg: "depositId is required" });
    }
    if (!action || !["approve", "reject", "cancelled"].includes(action)) {
      return res.status(500).json({ msg: "Valid action is required" });
    }
    if (!mongoose.Types.ObjectId.isValid(depositId)) {
      return res.status(500).json({ msg: "Invalid depositId format" });
    }

    const depositRequest = await depositModel
      .findOne({
        _id: depositId,
        status: "pending",
      })
      .session(session);
    if (!depositRequest) {
      return res
        .status(400)
        .json({ msg: `Deposit request not found to ${action}` });
    }
    const adminUser = await getActiveAdmin();
    const user = await userModel
      .findOne({
        _id: depositRequest.userId,
        status: "active",
      })
      .session(session);

    if (!user) {
      return res.status(400).json({ msg: "User not found" });
    }

    let actionText = "";
    if (action === "approve") {
      depositRequest.status = "approved";
      actionText = "approved";
    } else if (action === "reject") {
      if (!rejectResponse || rejectResponse.trim() === "") {
        return res.status(400).json({ msg: "Reject reason is required" });
      }
      depositRequest.rejectResponse = rejectResponse.trim();
      depositRequest.status = "rejected";
      actionText = "rejected";
    } else if (action === "cancelled") {
      depositRequest.status = "cancelled";
      actionText = "cancelled";
    }
    const savedRequest = await depositRequest.save({ session });
    if (savedRequest && action === "approve") {
      // 💰 Credit to user
      await userModel.updateOne(
        { _id: user._id },
        {
          $inc: {
            "walletDetails.balance": savedRequest.amount,
          },
        },
        { session },
      );
      const adminUpdate = await userModel.updateOne(
        {
          _id: adminUser._id,
          "walletDetails.balance": { $gte: savedRequest.amount },
        },
        {
          $inc: {
            "walletDetails.balance": -savedRequest.amount,
            "walletDetails.depositRequest": savedRequest.amount,
          },
        },
        { session },
      );

      if (adminUpdate.modifiedCount === 0) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          msg: "Admin has insufficient wallet balance",
        });
      }

      const transactions = await transactionModel.insertMany(
        [
          {
            userId: savedRequest.userId,
            transactionType: "credit",
            orderId: null,
            amount: savedRequest.amount,
            depositReuestId: savedRequest._id,
            category: "depositRequest",
            narration: "Deposit request approved",
          },
          {
            userId: adminUser._id,
            transactionType: "debit",
            orderId: null,
            amount: savedRequest.amount,
            depositReuestId: savedRequest._id,
            category: "depositRequest",
            narration: `Deposit request approved - ${user.firstName} ${user.lastName}`,
          },
        ],
        { session },
      );

      if (!transactions) {
        return res
          .status(400)
          .json({ msg: "Failed to create transaction record" });
      }
    }
    await session.commitTransaction();
    session.endSession();
    return res.status(200).json({
      msg: `Deposit request ${actionText} successfully`,
      data: depositRequest,
    });
  } catch (error) {
    console.error("❌ Get Deposit Requests Error:", error);
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({
      msg: "Internal server error",
    });
  }
};
module.exports = {
  withdrawRequest,
  addWalletBalance,
  getWithdrawRequests,
  approveRejecteWithdrawRequest,
  deductWalletBalance,
  createDepositRequest,
  getDepositRequests,
  approveRejecteDepositRequest,
};
