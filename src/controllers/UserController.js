const path = require("path");
const fs = require("fs");

const userModel = require("./../models/userModel");
const transactionModel = require("./../models/transactionModel");
const orderModel = require("./../models/orderModel");
const businessModel = require("../models/businessModel");
const { json } = require("body-parser");
const { paginateArray } = require("../CommanFuntion/Pagination");

const getUser = async (req, res) => {
  try {
    const { id, role, pageNumber, pageLimit, isPagination, searchText } =
      req.body;

    if (!id) {
      let users = [];
      if (role) {
        users = await userModel
          .find({ role: role.toLowerCase() })
          .select("-password -refreshToken -status -createdAt -updatedAt");
      } else {
        users = await userModel.aggregate([
          {
            $addFields: {
              statusOrder: {
                $switch: {
                  branches: [
                    { case: { $eq: ["$status", "pending"] }, then: 1 },
                    { case: { $eq: ["$status", "active"] }, then: 2 },
                    { case: { $eq: ["$status", "inactive"] }, then: 3 },
                  ],
                  default: 4,
                },
              },
            },
          },
          { $sort: { statusOrder: 1, createdAt: -1 } },
        ]);
      }
      if (!users || users.length === 0) {
        return res
          .status(404)
          .send({ msg: "No users present", data: null })
          .select("-password -refreshToken -status -createdAt -updatedAt");
      }
      const paginated = paginateArray({
        data: users,
        page: pageNumber,
        limit: pageLimit,
        isPagination: isPagination,
        search: searchText,
        searchKeys: [
          "firstName",
          "middleName",
          "lastName",
          "email",
          "mobile",
          "role",
          "aadhaarCardNumber",
          "currentAddress",
          "panCardNumber",
          "permanentAddress",
          "rationCardNumber",
          "walletDetails.referralPoints",
          "walletDetails.balance",
          "walletDetails.cashbackPoints",
          "walletDetails.levelId",
        ],
      });
      return res
        .status(200)
        .send({ msg: "Users fetched successfully", data: paginated });
    }

    // Fetch single user
    const user = await userModel.findById(
      id,
      "-password -refreshToken -__v  -updatedAt -referalUser -createdAt",
    );
    if (!user) {
      return res.status(404).send({ msg: "User not found", data: null });
    }

    // Fetch referred users
    const referredUsers = await userModel
      .find({ referalUser: id })
      .select("firstName lastName mobile email levelId createdAt imageUrl");

    let businessObj = null;

    // If shopkeeper → fetch business
    if (user.role === "shopkeeper") {
      const business = await businessModel
        .findOne({ shopkeeperId: user._id })
        .populate("categories");

      if (business) {
        businessObj = business.toObject();

        // Convert GeoJSON coordinates → latitude, longitude
        if (
          businessObj.location &&
          businessObj.location.coordinates?.length === 2
        ) {
          const [longitude, latitude] = businessObj.location.coordinates;
          businessObj.location = { latitude, longitude };
        }
      }
    }

    // Prepare final response
    const userData = {
      ...user.toObject(),
      business: businessObj, // null if not shopkeeper
      referredUsers,
    };

    return res
      .status(200)
      .send({ msg: "User fetched successfully", data: userData });
  } catch (error) {
    return res.status(500).send({ msg: error.message });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id, rationCardNumber, currentPincode, upi } = req.body;
    // ✅ PINCODE REGEX
    const pincodeRegex = /^[1-9][0-9]{5}$/;
    const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
    const mobileRegex = /^\d{10}$/;

    if (!id) {
      return res.status(400).send({ msg: "Please enter Id" });
    }

    const upiValue = upi?.toLowerCase();

    if (!upiRegex.test(upiValue) && !mobileRegex.test(upiValue)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid UPI ID or 10-digit mobile number",
      });
    }

    // ✅ Current Pincode Validation
    if (currentPincode && !pincodeRegex.test(currentPincode)) {
      return res.status(400).send({
        msg: "Invalid current address pincode",
      });
    }

    // 3️⃣ Check if ration card already registered
    if (rationCardNumber) {
      const existingRation = await userModel.findOne({ rationCardNumber });

      if (existingRation && existingRation._id.toString() !== id) {
        return res
          .status(400)
          .send({ msg: "Ration card number already registered" });
      }
    }

    let updateData = req.body;
    let oldImagePath = null;

    const updatedUser = await userModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true },
    );

    if (!updatedUser) {
      return res.status(400).send({
        msg: "User not found",
      });
    }
    // Unlinking old image in folder
    if (oldImagePath && fs.existsSync(oldImagePath)) {
      fs.unlinkSync(oldImagePath);
    }

    return res.status(200).send({
      msg: "User updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    return res.status(500).send({ msg: error.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { userId, status } = req.body;
    let finalStatusValue = "";
    if (!status) {
      return res.status(400).send({ msg: "Status is required" });
    }
    const userData = await userModel.findById(userId);
    if (!userData) {
      return res.status(404).send({ msg: "User not found" });
    }

    if (userData.status == "active") {
      finalStatusValue = "blocked";
    } else if (userData.status === "pending") {
      finalStatusValue = "approved";
    } else if (userData.status === "inactive") {
      finalStatusValue = "unblocked";
    } else {
      return res.status(400).send({ msg: "Invalid status value" });
    }

    const user = await userModel.findOneAndUpdate(
      { _id: userId },
      { $set: { status: status } },
      { new: true, runValidators: true },
    );

    if (!user) {
      return res.status(404).send({ msg: "User not found" });
    }

    return res.status(200).send({
      msg: `User ${finalStatusValue} successfully`,
    });
  } catch (error) {
    return res.status(500).send({ msg: error.message });
  }
};

const updateProfilePic = async (req, res) => {
  try {
    // ✅ Check file
    if (!req.files || !req.files.image) {
      return res.status(400).send({
        status: false,
        msg: "No image uploaded",
      });
    }

    const { userId } = req.body;
    if (!userId) {
      return res.status(400).send({
        status: false,
        msg: "User ID is required",
      });
    }

    const file = req.files.image;

    // ✅ Validate file type (only images)
    const allowedExtensions = [".jpg", ".jpeg", ".png", ".heif", ".heic"];
    const fileExt = path.extname(file.name).toLowerCase();

    if (!allowedExtensions.includes(fileExt)) {
      return res.status(400).send({
        status: false,
        msg: `Invalid file type. Allowed formats: ${allowedExtensions.join(
          ", ",
        )}`,
      });
    }

    // ✅ Validate file size (<= 5MB)
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_SIZE) {
      return res.status(400).send({
        status: false,
        msg: "File size exceeds 5 MB limit",
      });
    }

    // ✅ Prepare upload directory
    const uploadDir = "./public/images/userProfile/";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // ✅ Fetch old user data (to remove old image)
    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).send({
        status: false,
        msg: "User not found",
      });
    }

    // ✅ Generate new file name & path
    const fileName = `${userId}-${Date.now()}${fileExt}`;
    const filePath = path.join(uploadDir, fileName);
    const imageUrl = `/images/userProfile/${fileName}`;

    // ✅ Move new file to destination
    await file.mv(filePath);

    // ✅ Delete old image if exists
    if (user.imageUrl) {
      const oldImagePath = path.join("./public", user.imageUrl);
      if (fs.existsSync(oldImagePath)) {
        fs.unlinkSync(oldImagePath);
      }
    }

    // ✅ Update new image in DB
    await userModel.updateOne({ _id: userId }, { $set: { imageUrl } });

    // ✅ Success response
    res.status(200).send({
      status: true,
      msg: "Profile image updated successfully",
      data: { imageUrl },
    });
  } catch (error) {
    console.error("❌ Error updating profile:", error);
    res.status(500).send({
      status: false,
      msg: "Server error while uploading image",
      error: error.message,
    });
  }
};

const dashboardCounts = async (req, res) => {
  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const activeUsersCount = await userModel.countDocuments({
      status: "active",
    });

    const totalOrderAmountData = await orderModel.aggregate([
      { $match: { status: "Accepted" } },
      { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
    ]);

    const totalOrderAmount =
      totalOrderAmountData.length > 0 ? totalOrderAmountData[0].totalAmount : 0;

    const thisMonthOrderAmountData = await orderModel.aggregate([
      {
        $match: {
          status: "Accepted",
          createdAt: { $gte: monthStart, $lte: now },
        },
      },
      { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
    ]);

    const thisMonthOrderAmount =
      thisMonthOrderAmountData.length > 0
        ? thisMonthOrderAmountData[0].totalAmount
        : 0;

    const totalTransactionCount = await transactionModel.countDocuments();

    const thisMonthTransactionCount = await transactionModel.countDocuments({
      date: { $gte: monthStart, $lte: now },
    });
    const todaysTransactionCount = await transactionModel.countDocuments({
      date: { $gte: todayStart, $lte: todayEnd },
    });

    return res.status(200).json({
      success: true,
      dashboardCounts: {
        activeUsersCount,
        totalOrderAmount,
        thisMonthOrderAmount,
        totalTransactionCount,
        thisMonthTransactionCount,
        todaysTransactionCount,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

const pincodeUserCount = async (req, res) => {
  try {
    const { pincode } = req.body;

    if (!pincode || typeof pincode !== "string") {
      return res.status(400).json({
        success: false,
        message: "Valid pincode is required",
      });
    }

    const userCount = await userModel.countDocuments({
      currentPincode: pincode.trim(),
      status: "active",
    });

    return res.status(200).json({ success: true, count: userCount });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  updateUser: updateUser,
  getUser: getUser,
  updateProfilePic: updateProfilePic,
  deleteUser: deleteUser,
  dashboardCounts,
  pincodeUserCount,
};
