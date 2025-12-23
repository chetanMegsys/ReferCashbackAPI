const businessModel = require("../../models/businessModel");
const userModel = require("../../models/userModel");

const isBusinessExists = async (businessId) => {
  let result = false;
  const businessDetails = await businessModel.findOne({
    _id: businessId,
    status: "active",
  });

  if (businessDetails) {
    result = true;
  }
  return result;
};
const businessDetails = async (businessId) => {
  const businessDetail = await businessModel.findOne({
    _id: businessId,
    status: "active",
  });

  return businessDetail;
};

const isUserExists = async (userId, role) => {
  let result = false;
  const userDetails = await userModel
    .findOne({
      _id: userId,
      status: "active",
      role: role,
    })
    .select("firstName middleName lastName role currentAddress");

  if (userDetails) {
    result = true;
  }
  return result;
};
const isUserIdExists = async (userId) => {
  let result = false;

  const userDetails = await userModel
    .findOne({
      _id: userId,
      status: "active",
    })
    .select("firstName middleName lastName role currentAddress");

  if (userDetails) {
    result = true;
  }
  return result;
};
module.exports = {
  isBusinessExists,
  isUserExists,
  businessDetails,
  isUserIdExists,
};
