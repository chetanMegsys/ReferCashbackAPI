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

  const business = await businessModel
    .findOne({ shopkeeperId })
    .select("discountPercentage");
  if (!business) throw new Error("Shopkeeper not found");

  const cashbackPercent = business.discountPercentage || 0;
  const totalCashback = Number(
    ((orderAmount * cashbackPercent) / 100).toFixed(2)
  );

  const buyer = await userModel.findById(userId);
  if (!buyer) throw new Error("Buyer not found");

  const directReferrer = buyer.referalUser
    ? await userModel
        .findById(buyer.referalUser)
        .select("firstName lastName mobile")
    : null;

  // ✅ LEVEL CASHBACK — Upward only (parents)
  const getUpstreamUsers = async (startingUserId, maxLevels) => {
    const result = [];
    let currentUser = await userModel
      .findById(startingUserId)
      .select("parentId");

    let level = 0;
    while (currentUser?.parentId && level < maxLevels) {
      const parent = await userModel
        .findById(currentUser.parentId)
        .select("firstName lastName mobile parentId");

      if (!parent) break;

      result.push({
        userId: parent._id,
        name: `${parent.firstName || ""} ${parent.lastName || ""}`.trim(),
        mobile: parent.mobile,
      });

      currentUser = parent;
      level++;
    }

    return result;
  };

  // ✅ IROI2 CASHBACK — Upward + Downward up to 20 levels
  const getUpAndDownUsers = async (startingUserId, maxLevels) => {
    const visited = new Set();
    const users = [];

    // helper to fetch children recursively
    const getChildren = async (userIds, level = 0) => {
      if (level >= maxLevels || !userIds.length) return;
      const children = await userModel
        .find({ parentId: { $in: userIds } })
        .select("firstName lastName mobile _id");

      for (const child of children) {
        if (!visited.has(child._id.toString())) {
          users.push({
            userId: child._id,
            name: `${child.firstName || ""} ${child.lastName || ""}`.trim(),
            mobile: child.mobile,
          });
          visited.add(child._id.toString());
        }
      }

      await getChildren(
        children.map((c) => c._id),
        level + 1
      );
    };

    // upward
    const upUsers = await getUpstreamUsers(startingUserId, maxLevels);
    users.push(...upUsers);

    // downward
    await getChildren([startingUserId]);

    // remove duplicates
    const unique = users.filter(
      (u, i, self) =>
        i === self.findIndex((t) => t.userId.toString() === u.userId.toString())
    );

    return unique;
  };

  // ✅ IROI1 — Direct Referral chain (10 levels)
  const getDirectReferralChain = async (startingUserId, maxLevels) => {
    const chain = [];
    let currentUserId = startingUserId;
    let count = 0;

    while (currentUserId && count < maxLevels) {
      const user = await userModel
        .findById(currentUserId)
        .select("referalUser firstName lastName mobile");
      if (!user) break;

      if (user.referalUser) {
        const refUser = await userModel
          .findById(user.referalUser)
          .select("firstName lastName mobile");
        if (refUser) {
          chain.push({
            userId: refUser._id,
            name: `${refUser.firstName || ""} ${refUser.lastName || ""}`.trim(),
            mobile: refUser.mobile,
          });
        }
        currentUserId = user.referalUser;
      } else break;

      count++;
    }

    return chain;
  };

  // 🔢 Percentages
  const customerPercent = Number(process.env.CUSTOMER_PERCENTAGE) || 50;
  const directReferralPercent = Number(process.env.REFERRER_PERCENTAGE) || 10;
  const rorPercent = Number(process.env.ROR_PERCENTAGE) || 1;
  const levelPercent = Number(process.env.LEVEL_PERCENTAGE) || 20;
  const irot1Percent = Number(process.env.IROT1_PERCENTAGE) || 2;
  const irot2Percent = Number(process.env.IROT2_PERCENTAGE) || 2;
  const shopkeeperPercent = Number(process.env.TIUP_PERCENTAGE) || 5;
  const superAdminPercent = Number(process.env.SUPERADMIN_PERCENTAGE) || 10;

  // 🧮 Fetch user levels
  const levelUsers = await getUpstreamUsers(userId, 10);
  const irot2Users = await getUpAndDownUsers(userId, 20);
  const irot1Users = await getDirectReferralChain(userId, 10);

  const calcDistribution = (users, percent) => {
    const totalAmount = Number(((totalCashback * percent) / 100).toFixed(2));
    const perUser = users.length
      ? Number((totalAmount / users.length).toFixed(2))
      : 0;
    return users.map((u) => ({ ...u, cashback: perUser }));
  };

  const levelDistribution = calcDistribution(levelUsers, levelPercent);
  const irot2Distribution = calcDistribution(irot2Users, irot2Percent);
  const irot1Distribution = calcDistribution(irot1Users, irot1Percent);

  // 🧾 ROR, Shopkeeper, Superadmin same as before
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
        cashback: Number(((orderAmount * rorPercent) / 100).toFixed(2)),
      };
    }
  }

  const adminUsers = await userModel
    .find({ role: "admin" })
    .select("firstName lastName mobile");
  const superAdminTotal = Number(
    ((totalCashback * superAdminPercent) / 100).toFixed(2)
  );
  const superAdminPerUser = adminUsers.length
    ? Number((superAdminTotal / adminUsers.length).toFixed(2))
    : 0;
  const superAdminDistribution = adminUsers.map((u) => ({
    userId: u._id,
    name: `${u.firstName || ""} ${u.lastName || ""}`.trim(),
    mobile: u.mobile,
    cashback: superAdminPerUser,
  }));

  // 🧩 Cashback mapping
  const cashbackReceivers = {
    customer: {
      userId: buyer._id,
      name: `${buyer.firstName || ""} ${buyer.lastName || ""}`.trim(),
      cashback: Number(((totalCashback * customerPercent) / 100).toFixed(2)),
    },
    referrer: directReferrer
      ? {
          userId: directReferrer._id,
          name: `${directReferrer.firstName || ""} ${
            directReferrer.lastName || ""
          }`.trim(),
          cashback: Number(
            ((totalCashback * directReferralPercent) / 100).toFixed(2)
          ),
        }
      : null,
    shopkeeper: {
      userId: shopkeeperId,
      cashback: Number(((totalCashback * shopkeeperPercent) / 100).toFixed(2)),
    },
    superadmin: superAdminDistribution,
    levels: levelDistribution,
    irot1: irot1Distribution,
    irot2: irot2Distribution,
    ror: {
      totalROR: Number(((orderAmount * rorPercent) / 100).toFixed(2)),
      percent: rorPercent,
      receiver: rorReceiver,
    },
    totalCashback,
  };

  // 📊 Summary
  const cashbackSummary = {
    customer: cashbackReceivers.customer.cashback || 0,
    referrer: cashbackReceivers.referrer?.cashback || 0,
    shopkeeper: cashbackReceivers.shopkeeper.cashback || 0,
    superadmin: superAdminDistribution.reduce(
      (acc, cur) => acc + cur.cashback,
      0
    ),
    levels: levelDistribution.reduce((acc, cur) => acc + cur.cashback, 0),
    irot1: irot1Distribution.reduce((acc, cur) => acc + cur.cashback, 0),
    irot2: irot2Distribution.reduce((acc, cur) => acc + cur.cashback, 0),
    ror: rorReceiver?.cashback || 0,
  };

  return { cashbackReceivers, cashbackSummary };
};

module.exports = calculateCashbackHelper;
