const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true, // optional but helps avoid duplicates
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("categories", categorySchema);
