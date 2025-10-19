const userModel = require("../models/userModel");
const businessModel = require("../models/businessModel");

const calculateCashbackHelper = async ({
  userId,
  shopkeeperId,
  orderAmount,
}) => {
  if (!userId || !shopkeeperId || !orderAmount) {
    throw new Error("Missing required fields for cashback calculation");
  }

  // Get shopkeeper business discount
  const business = await businessModel
    .findOne({ shopkeeperId })
    .select("discountPercentage");
  if (!business) throw new Error("Shopkeeper not found");

  const cashbackPercent = business.discountPercentage || 0;
  const totalCashback = (orderAmount * cashbackPercent) / 100;

  // Get buyer
  const buyer = await userModel.findById(userId);
  if (!buyer) throw new Error("Buyer not found");

  // Direct referrer
  const directReferrer = buyer.referalUser
    ? await userModel
        .findById(buyer.referalUser)
        .select("firstName lastName mobile")
    : null;

  // Parent path (all ancestors)
  const parentPath = [];
  let currentParentId = buyer.parentId;
  while (currentParentId) {
    const parentUser = await userModel
      .findById(currentParentId)
      .select("firstName lastName mobile levelId parentId");
    if (!parentUser) break;
    parentPath.push(parentUser);
    currentParentId = parentUser.parentId;
  }

  // Helper: Equal distribution
  const distributeEqual = (path, percent, maxLevels) => {
    const relevant = path.slice(0, maxLevels);
    const perUserCashback =
      relevant.length > 0
        ? (totalCashback * percent) / 100 / relevant.length
        : 0;

    return relevant.map((u) => ({
      userId: u._id,
      name: `${u.firstName || ""} ${u.lastName || ""}`.trim(),
      mobile: u.mobile,
      cashback: perUserCashback,
    }));
  };

  // Percentages from env
  const customerPercent = Number(process.env.CUSTOMER_PERCENTAGE) || 50;
  const directReferralPercent = Number(process.env.REFERRER_PERCENTAGE) || 10;
  const rorPercent = Number(process.env.ROR_PERCENTAGE) || 1;
  const levelPercent = Number(process.env.LEVEL_PERCENTAGE) || 20;
  const irot1Percent = Number(process.env.IROT1_PERCENTAGE) || 2;
  const irot2Percent = Number(process.env.IROT2_PERCENTAGE) || 2;
  const shopkeeperPercent = Number(process.env.TIUP_PERCENTAGE) || 5;
  const superAdminPercent = Number(process.env.SUPERADMIN_PERCENTAGE) || 10;

  // Level / IROT-1 / IROT-2
  const levelDistribution = distributeEqual(parentPath, levelPercent, 10);
  const irot1Distribution = distributeEqual(parentPath, irot1Percent, 10);
  const irot2Distribution = distributeEqual(parentPath, irot2Percent, 20);

  // ROR (shopkeeper's referrer)
  const shopkeeper = await userModel.findById(shopkeeperId);
  let rorReceiver = null;
  if (shopkeeper?.referalUser) {
    const ref = await userModel
      .findById(shopkeeper.referalUser)
      .select("firstName lastName mobile");
    if (ref) {
      rorReceiver = {
        userId: ref._id,
        name: `${ref.firstName || ""} ${ref.lastName || ""}`.trim(),
        mobile: ref.mobile,
        cashback: (orderAmount * rorPercent) / 100,
      };
    }
  }

  // Map receivers
  const cashbackReceivers = {
    customer: {
      userId: buyer._id,
      name: `${buyer.firstName || ""} ${buyer.lastName || ""}`.trim(),
      cashback: (totalCashback * customerPercent) / 100,
    },
    referrer: directReferrer
      ? {
          userId: directReferrer._id,
          name: `${directReferrer.firstName || ""} ${
            directReferrer.lastName || ""
          }`.trim(),
          cashback: (totalCashback * directReferralPercent) / 100,
        }
      : null,
    shopkeeper: {
      userId: shopkeeperId,
      cashback: (totalCashback * shopkeeperPercent) / 100,
    },
    superadmin: {
      name: "SuperAdmin",
      cashback: (totalCashback * superAdminPercent) / 100,
    },
    levels: levelDistribution,
    irot1: irot1Distribution,
    irot2: irot2Distribution,
    ror: {
      totalROR: (orderAmount * rorPercent) / 100,
      percent: rorPercent,
      receiver: rorReceiver,
    },
    totalCashback,
  };

  // ✅ New object: summary of cashback by type
  const cashbackSummary = {
    customer: cashbackReceivers.customer.cashback || 0,
    referrer: cashbackReceivers.referrer?.cashback || 0,
    shopkeeper: cashbackReceivers.shopkeeper.cashback || 0,
    superadmin: cashbackReceivers.superadmin.cashback || 0,
    levels: levelDistribution.reduce((acc, cur) => acc + cur.cashback, 0),
    irot1: irot1Distribution.reduce((acc, cur) => acc + cur.cashback, 0),
    irot2: irot2Distribution.reduce((acc, cur) => acc + cur.cashback, 0),
    ror: rorReceiver?.cashback || 0,
  };

  return { cashbackReceivers, cashbackSummary };
};

module.exports = calculateCashbackHelper;
