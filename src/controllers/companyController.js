const { compare } = require("bcrypt");

const getCompanyDetails = async (req, res) => {
  try {
    const { id, role } = req.body;

    companyData = {
      googleApiKey: process.env.GOOGLEAPIKEY,
      minimumBalance: process.env.MINBALANCE,
    };
    return res
      .status(200)
      .send({ msg: "User fetched successfully", data: companyData });
  } catch (error) {
    return res.status(500).send({ msg: error.message });
  }
};

module.exports = {
  getCompanyDetails: getCompanyDetails,
};
