const { compare } = require("bcrypt");

const getCompanyDetails = async (req, res) => {
  try {
    const { id, role } = req.body;

    companyData = {
      googleApiKey: process.env.GOOGLEAPIKEY,
      minimumBalance: process.env.MINBALANCE,
      androidLink: process.env.ANDROID_LINK,
      contactNo: process.env.CONTACT_NUMBER,
    };
    return res
      .status(200)
      .send({ msg: "Company details fetched successfully", data: companyData });
  } catch (error) {
    return res.status(500).send({ msg: error.message });
  }
};

module.exports = {
  getCompanyDetails: getCompanyDetails,
};
