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
  const adminUsers = await userModel
    .findOne({ role: "admin" })
    .select("firstName lastName mobile");
  const buyer = await userModel.findById(userId);
  if (!buyer) throw new Error("Buyer not found");

  // 🔢 Percentages
  const customerPercent = Number(process.env.CUSTOMER_PERCENTAGE) ;
  const directReferralPercent = Number(process.env.REFERRER_PERCENTAGE) ;
  const rorPercent = Number(process.env.ROR_PERCENTAGE) ;
  const levelPercent = Number(process.env.LEVEL_PERCENTAGE) ;
  const irot1Percent = Number(process.env.IROT1_PERCENTAGE) ;
  const irot2Percent = Number(process.env.IROT2_PERCENTAGE) ;
  const shopkeeperPercent = Number(process.env.TIUP_PERCENTAGE) ;
  const superAdminPercent = Number(process.env.SUPERADMIN_PERCENTAGE) ;
  const adminPercent = Number(process.env.ADMIN) ;

  const hasValidDocs = buyer.aadhaarCardNumber && buyer.rationCardNumber;
  const shopkeeper = await userModel.findOne({ _id: shopkeeperId });

  let refreshedShopkeeper = await userModel.findById(shopkeeper?.referalUser);
  // If buyer doesn't have both, assign everything to admin
  if (!hasValidDocs) {
    const cashback = Number(
      ((totalCashback * customerPercent) / 100).toFixed(2)
    );
    const TIUPCashback = Number(
      ((totalCashback * shopkeeperPercent) / 100).toFixed(2)
    );
    const cashbackReceivers = {
      customer: {
        userId: adminUsers._id,
        name: `${buyer.firstName || ""} ${buyer.lastName || ""}`.trim(),
        cashback: cashback,
      },
      referrer: null,
      shopkeeper: {
        userId: refreshedShopkeeper?._id,
        name: `${refreshedShopkeeper?.firstName || ""} ${
          refreshedShopkeeper?.lastName
        }`,
        cashback: TIUPCashback,
      },
      superadmin: [
        {
          ...adminUsers.toObject?.(), // handles Mongoose doc or plain object
          cashback: totalCashback - cashback - TIUPCashback,
        },
      ],
      levels: [],
      irot1: [],
      irot2: [],
      ror: {
        totalROR: 0,
        percent: 0,
        receiver: null,
      },
      totalCashback,
    };

    const cashbackSummary = {
      totalCashback,
      customer: cashback,
      referrer: 0,
      shopkeeper: 0,
      superadmin: totalCashback - cashback,
      levels: 0,
      irot1: 0,
      irot2: 0,
      ror: 0,
    };

    return { cashbackReceivers, cashbackSummary };
  }

  if (!refreshedShopkeeper) {
    refreshedShopkeeper = adminUsers; // fallback if not found
  }

  const directReferrer = buyer.referalUser
    ? await userModel
        .findById(buyer.referalUser)
        .select("firstName lastName mobile")
    : adminUsers;

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

  // 🧮 Fetch user levels
  const levelUsers = await getUpstreamUsers(userId, 10);
  const irot2Users = await getUpAndDownUsers(userId, 20);
  const irot1Users = await getDirectReferralChain(userId, 10);

  const calcDistribution = (users, percent, maxLevels, adminUser) => {
    const totalAmount = Number(((totalCashback * percent) / 100).toFixed(2));

    let perUser = 0;
    let distributed = 0;

    if (users.length > 0) {
      // Divide only among present users
      perUser = Number((totalAmount / maxLevels).toFixed(2));
      distributed = perUser * users.length;
    }

    const remaining = Number((totalAmount - distributed).toFixed(2));

    // Assign cashback to present users
    const result = users.map((u) => ({
      ...u,
      cashback: perUser,
    }));

    // If admin/min should get remaining
    if (remaining > 0 && adminUser) {
      result.push({
        ...adminUsers.toObject?.(), // handles Mongoose doc or plain object
        cashback: remaining,
      });
    }

    return result;
  };

  const levelDistribution = calcDistribution(
    levelUsers,
    levelPercent,
    10,
    adminUsers
  );
  const irot2Distribution = calcDistribution(
    irot2Users,
    irot2Percent,
    20,
    adminUsers
  );
  const irot1Distribution = calcDistribution(
    irot1Users,
    irot1Percent,
    10,
    adminUsers
  );

  // 🧾 ROR, Shopkeeper, Superadmin same as before
  const RORUser = await userModel.findById(directReferrer?._id);

  let rorReceiver = null;
  if (RORUser) {
    const ref = await userModel
      .findById(RORUser.referalUser)
      .select("firstName lastName mobile");

    if (ref) {
      // ✅ If ref exists, use its details
      rorReceiver = {
        userId: ref._id,
        name: `${ref.firstName || ""} ${ref.lastName || ""}`.trim(),
        mobile: ref.mobile,
        cashback: Number(((totalCashback * rorPercent) / 100).toFixed(2)),
      };
    } else {
      // ⚙️ If ref not found, assign to an admin user
      const adminUser = await userModel
        .findOne({ role: "admin" })
        .select("firstName lastName mobile");

      if (adminUser) {
        rorReceiver = {
          userId: adminUser._id,
          name: `${adminUser.firstName || ""} ${
            adminUser.lastName || ""
          }`.trim(),
          mobile: adminUser.mobile,
          cashback: Number(((totalCashback * rorPercent) / 100).toFixed(2)),
        };
      } else {
        // Optional: handle case where no admin exists
        throw new Error("No ref or admin user found to assign ROR receiver.");
      }
    }
  }

  const superAdminTotal = Number(
    ((totalCashback * superAdminPercent) / 100).toFixed(2)
  );
  const adminTotal = Number(((totalCashback * adminPercent) / 100).toFixed(2));

  const superAdminDistribution = {
    ...adminUsers.toObject?.(), // handles Mongoose doc or plain object
    cashback: superAdminTotal,
  };
  const adminDistribution = {
    ...adminUsers.toObject?.(), // handles Mongoose doc or plain object
    cashback: adminTotal,
  };

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
    //shopkeeper = TIUP user
    shopkeeper: {
      userId: refreshedShopkeeper?._id,
      name: `${refreshedShopkeeper?.firstName || ""} ${
        refreshedShopkeeper?.lastName
      }`,
      cashback: Number(((totalCashback * shopkeeperPercent) / 100).toFixed(2)),
    },
    superadmin: [superAdminDistribution],
    admin: [adminDistribution],
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
    totalCashback: totalCashback,
    customer: cashbackReceivers.customer.cashback || 0,
    referrer: cashbackReceivers.referrer?.cashback || 0,
    shopkeeper: cashbackReceivers.shopkeeper.cashback || 0,
    superadmin: superAdminDistribution.cashback,
    admin: adminDistribution.cashback,
    levels: levelDistribution.reduce((acc, cur) => acc + cur.cashback, 0),
    irot1: irot1Distribution.reduce((acc, cur) => acc + cur.cashback, 0),
    irot2: irot2Distribution.reduce((acc, cur) => acc + cur.cashback, 0),
    ror: rorReceiver?.cashback || 0,
  };

  return { cashbackReceivers, cashbackSummary };
};

module.exports = calculateCashbackHelper;
