const mongoose = require("mongoose");

const businessSchema = new mongoose.Schema({
  businessName: {
    type: String,
    // required: true,
  },
  businessId: {
    type: String,
  },
  categories: {
    // type: [String],
    type: [mongoose.Schema.Types.ObjectId],
    ref: "categories",
    // required: true,
  },
  shopkeeperId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "users",
  },
  address: {
    type: String,
    // required: true,
  },
  discountPercentage: {
    type: Number,
    min: 0,
    max: 100, // discount should not exceed 100%
    default: 0,
  },
  // imageUrl: {
  //   type: String,
  //   // required: true,
  // },
  location: {
    type: {
      type: String,
      enum: ["Point"], // GeoJSON type
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      //   required: true,
    },
  },
});

businessSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("businesses", businessSchema);
