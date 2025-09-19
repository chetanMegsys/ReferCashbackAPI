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
    },

    mobile: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    bankName: {
      type: String,
    },
    accountNo: {
      type: String,
    },
    role: {
      type: String,
      enum: ["customer", "shopkeeper", "admin"],
    },
    imageUrl: {
      type: String,
      default: null,
    },
    sponsorId: {
      type: String,
    },
    refreshToken: {
      type: String,
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
    },
  },

  { timestamps: true }
);

const users = mongoose.model("users", userSchema);

module.exports = users;
