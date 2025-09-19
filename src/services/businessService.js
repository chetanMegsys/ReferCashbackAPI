// services/businessService.js
const businessModel = require("../models/businessModel");

const createOrUpdateBusiness = async (data) => {
  const { id, lat, long, categories, ...restData } = data;
  const formattedCategories = [].concat(categories || []);

  let location = null;
  if (lat && long) {
    location = {
      type: "Point",
      coordinates: [parseFloat(long), parseFloat(lat)],
    };
  }

  if (!id) {
    // Create
    const newBusiness = await businessModel.create({
      ...restData,
      categories: formattedCategories,
      ...(location && { location }),
      ...(lat && { lat: parseFloat(lat) }),
      ...(long && { long: parseFloat(long) }),
    });
    return newBusiness;
  } else {
    // Update
    const updateData = { ...restData, categories: formattedCategories };
    if (lat && long) {
      updateData.lat = parseFloat(lat);
      updateData.long = parseFloat(long);
      updateData.location = location;
    }
    const updatedBusiness = await businessModel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    );
    return updatedBusiness;
  }
};

module.exports = { createOrUpdateBusiness };
