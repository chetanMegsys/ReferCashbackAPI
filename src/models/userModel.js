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
      match: [/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN card format"],
    },
    aadhaarCardNumber: {
      type: String,
      required: false,
      trim: true,
      match: [/^(\d{4}\s?){3}$/, "Aadhaar number must be 12 digits"],
    },
    rationCardNumber: {
      type: String,
      required: false,
      trim: true,
      match: [
        /^\d{12}$/,
        "Ration card number must be 12 characters (2 letters + 10 digits)",
      ],
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
