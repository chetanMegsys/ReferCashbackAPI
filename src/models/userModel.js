const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
    },
    middleName: {
      type: String,
      required: false,
    },
    lastName: {
      type: String,
      // required: true,
    },
    email: {
      type: String,
      required: false,
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        "Please fill a valid email address",
      ],
    },

    mobile: {
      type: String,
      required: true,
      unique: true,
      match: [/^\d{10}$/, "Please enter a valid 10-digit mobile number"],
    },
    password: {
      type: String,
      required: true,
    },
    bankName: {
      type: String,
      trim: true,
    },
    accountHolderName: {
      type: String,
      trim: true,
    },
    accountNo: {
      type: String,
      trim: true,
    },
    ifscCode: {
      type: String,
      trim: true,
      uppercase: true,
    },
    upi: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      enum: ["customer", "shopkeeper", "admin"],
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    imageUrl: {
      type: String,
      default: null,
    },
    sponsorId: {
      type: String,
    },
    levelId: {
      type: Number,
      default: 1, // optional default value
      required: false, // optional field
    },
    refreshToken: {
      type: String,
    },
    referalUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
    },
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      default: null,
    },

    currentAddress: {
      type: String,
      required: true,
      trim: true,
    },
    currentPincode: {
      type: String,
      required: true,
    },
    permanentAddress: {
      type: String,
      required: true,
      trim: true,
    },
    permanentPincode: {
      type: String,
      required: true,
    },

    panCardNumber: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    aadhaarCardNumber: {
      type: String,
      required: false,
      trim: true,
    },
    rationCardNumber: {
      type: String,
      required: false,
      trim: true,
    },

    walletDetails: {
      walletId: {
        type: mongoose.Schema.Types.ObjectId,
        //Only if we want to have wallet for all users to generate automatically
        // default: () => new mongoose.Types.ObjectId(),
      },
      balance: {
        type: Number,
        default: 0,
      },
      cashbackPoints: {
        type: Number,
        default: 0,
      },
      referralPoints: {
        type: Number,
        default: 0,
      },
      nextMonthDeduction: { type: Number, default: 0 },
    },
  },

  { timestamps: true }
);

const users = mongoose.model("users", userSchema);

module.exports = users;
