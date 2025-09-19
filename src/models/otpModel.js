const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema({
  mobile: { type: String, required: true },
  otp: { type: String, required: true },
  status: {
    type: String,
    enum: ["active", "expired", "used"],
    default: "active",
  },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true }, // 5 minutes expiry
});

const otps = mongoose.model("otps", otpSchema);
module.exports = otps;
