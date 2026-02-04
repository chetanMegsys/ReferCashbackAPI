const mongoose = require("mongoose");
const walletBalanceModel = require("../models/walletBalanceModel");
const userModel = require("./../models/userModel");
const transactionModel = require("./../models/transactionModel");
const { paginateArray } = require("../CommanFuntion/Pagination");
const { formatTo12Hour } = require("../CommanFuntion/convertTo12hours");

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
    await userExists.save();

    const newTrans = await transactionModel.create({
      userId,
      transactionType: "credit",
      orderId: null,
      amount,
      category: "adminCredit",
      narration: "Amount credited by admin",
    });

    if (!newTrans) {
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
    const { withdrawId, pageNumber, pageLimit, isPagination, searchText } =
      req.body;

    if (!withdrawId) {
      const allRequests = await walletBalanceModel.aggregate([
        {
          $addFields: {
            statusOrder: {
              $switch: {
                branches: [
                  { case: { $eq: ["$status", "pending"] }, then: 1 },
                  { case: { $eq: ["$status", "approved"] }, then: 2 },
                  { case: { $eq: ["$status", "rejected"] }, then: 3 },
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
          $project: {
            statusOrder: 0,
            updatedAt: 0,
            __v: 0,
            "userDetails.password": 0,
            "userDetails.__v": 0,
            "userDetails.refreshToken": 0,
            "userDetails.walletDetails": 0,
            "userDetails.createdAt": 0,
            "userDetails.updatedAt": 0,
            "userDetails.referalUser": 0,
            "userDetails.deviceDetails": 0,
          },
        },
      ]);

      if (!allRequests || allRequests.length === 0) {
        return res.status(404).json({ msg: "No withdraw requests found" });
      }

      // const allRequestsWithFormattedDate = allRequests.map((item) => {
      //   const formatted = {
      //     ...item,
      //     formattedDate: formatTo12Hour(item.createdAt),
      //   };
      //   delete formatted.createdAt;
      //   return formatted;
      // });

      // const paginated = paginateArray({
      //   data: allRequestsWithFormattedDate,
      //   page: pageNumber,
      //   limit: pageLimit,
      //   isPagination,
      //   search: searchText,
      //   searchKeys: ["amount", "status"],
      // });

      const paginated = paginateArray({
        data: allRequests,
        page: pageNumber,
        limit: pageLimit,
        isPagination,
        search: searchText,
        searchKeys: ["amount", "status"],
      });

      const paginatedWithFormattedDate = {
        ...paginated,
        data: paginated.data.map((item) => {
          const formatted = {
            ...item,
            formattedDate: formatTo12Hour(item.createdAt),
          };
          delete formatted.createdAt;
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
  try {
    const { withdrawId, action, utrNo } = req.body;
    if (!withdrawId) {
      return res.status(500).json({ msg: "withdrawId is required" });
    }
    if (!action || !["approve", "reject"].includes(action)) {
      return res.status(500).json({ msg: "Valid action is required" });
    }
    if (!mongoose.Types.ObjectId.isValid(withdrawId)) {
      return res.status(500).json({ msg: "Invalid withdrawId format" });
    }
    const withdrawRequest = await walletBalanceModel.findOne({
      _id: withdrawId,
      status: "pending",
    });
    const minimumBalance = process.env.MINBALANCE;
    if (!withdrawRequest) {
      return res
        .status(404)
        .json({ msg: `Withdraw request not found to ${action}` });
    }

    const user = await userModel.findOne({
      _id: withdrawRequest.userId,
      status: "active",
    });

    if (!user) {
      return res.status(400).json({ msg: "User not found" });
    }

    let actionText = "";
    if (action === "approve") {
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
      actionText = "approved";
    } else if (action === "reject") {
      withdrawRequest.status = "rejected";
      actionText = "rejected";
    }

    const savedRequest = await withdrawRequest.save();

    if (savedRequest && action === "approve") {
      user.walletDetails.balance -= savedRequest.amount;
      await user.save();

      const newTrans = await transactionModel.create({
        userId: savedRequest.userId,
        transactionType: "debit",
        orderId: null,
        amount: savedRequest.amount,
        requestId: savedRequest._id,
        category: "withdrawalRequest",
        narration: "Withdrawal request approved",
      });

      if (!newTrans) {
        return res
          .status(400)
          .json({ msg: "Failed to create transaction record" });
      }
    }

    return res.status(200).json({
      msg: `Withdraw request ${actionText} successfully`,
      data: withdrawRequest,
    });
  } catch (error) {
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
          amount: actualDeducted, // now correct
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

      return res.status(200).json({
        success: true,
        message: "Deducted successfully ",
        modifiedCount: result.modifiedCount,
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

module.exports = {
  withdrawRequest,
  addWalletBalance,
  getWithdrawRequests,
  approveRejecteWithdrawRequest,
  deductWalletBalance,
};
