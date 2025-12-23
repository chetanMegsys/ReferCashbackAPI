// const userModel = require("../models/userModel");
// const businessModel = require("../models/businessModel");
// const { isUserIdExists } = require("./commonQueries/commonQuerries");

// const calculateCashbackHelper = async ({
//   userId,
//   shopkeeperId,
//   orderAmount,
// }) => {
//   if (!userId || !shopkeeperId || !orderAmount) {
//     return "Missing required fields for cashback calculation";
//   }

//   const isUser = await isUserIdExists(userId);

//   if (!(await isUserIdExists(userId))) {
//     return "Buyer does not exist";
//   }

//   if (!(await isUserIdExists(shopkeeperId))) {
//     return "Shopkeeper does not exist";
//   }

//   const business = await businessModel
//     .findOne({ shopkeeperId })
//     .select("discountPercentage");
//   if (!business) return "Shopkeeper not found";

//   const cashbackPercent = business.discountPercentage || 0;
//   const totalCashback = Number(
//     ((orderAmount * cashbackPercent) / 100).toFixed(2)
//   );

//   // const adminUsers = await userModel
//   //   .findOne({ role: "admin", status: "active" })
//   //   .select("_id firstName lastName mobile");
//   const result = await userModel
//     .findOne({ role: "admin", status: "active" })
//     .select("_id firstName lastName mobile");

//   const adminUsers = {
//     userId: result._id,
//     firstName: result.firstName,
//     lastName: result.lastName,
//     mobile: result.mobile,
//   };

//   const buyer = await userModel.findById(userId);

//   // 🔢 ENV percentages
//   const customerPercent = Number(process.env.CUSTOMER_PERCENTAGE);
//   const directReferralPercent = Number(process.env.REFERRER_PERCENTAGE);
//   const rorPercent = Number(process.env.ROR_PERCENTAGE);
//   const levelPercent = Number(process.env.LEVEL_PERCENTAGE);
//   const irot1Percent = Number(process.env.IROT1_PERCENTAGE);
//   const irot2Percent = Number(process.env.IROT2_PERCENTAGE);
//   const shopkeeperPercent = Number(process.env.TIUP_PERCENTAGE);
//   const superAdminPercent = Number(process.env.SUPERADMIN_PERCENTAGE);
//   const adminPercent = Number(process.env.ADMIN);

//   const hasValidDocs = buyer.aadhaarCardNumber && buyer.rationCardNumber;

//   const shopkeeper = await userModel.findById(shopkeeperId);

//   // 🔁 Shopkeeper referral (TIUP)
//   let refreshedShopkeeper =
//     shopkeeper?.referalUser && (await isUserIdExists(shopkeeper.referalUser))
//       ? await userModel.findById(shopkeeper.referalUser)
//       : adminUsers;

//   // 🚫 If buyer docs missing → all to admin (UNCHANGED LOGIC)
//   if (!hasValidDocs) {
//     const customerCashback = Number(
//       ((totalCashback * customerPercent) / 100).toFixed(2)
//     );
//     const tiupCashback = Number(
//       ((totalCashback * shopkeeperPercent) / 100).toFixed(2)
//     );

//     return {
//       cashbackReceivers: {
//         customer: {
//           userId: buyer._id,
//           name: `${buyer.firstName || ""} ${buyer.lastName || ""}`.trim(),
//           cashback: customerCashback,
//         },
//         referrer: null,
//         shopkeeper: {
//           userId: refreshedShopkeeper._id,
//           name: `${refreshedShopkeeper.firstName || ""} ${
//             refreshedShopkeeper.lastName || ""
//           }`.trim(),
//           cashback: tiupCashback,
//         },
//         superadmin: [
//           {
//             ...adminUsers,
//             cashback: totalCashback - customerCashback - tiupCashback,
//           },
//         ],
//         levels: [],
//         irot1: [],
//         irot2: [],
//         ror: { totalROR: 0, percent: 0, receiver: null },
//         totalCashback,
//       },
//       cashbackSummary: {
//         totalCashback,
//         customer: customerCashback,
//         referrer: 0,
//         shopkeeper: tiupCashback,
//         superadmin: totalCashback - customerCashback - tiupCashback,
//         levels: 0,
//         irot1: 0,
//         irot2: 0,
//         ror: 0,
//       },
//     };
//   }

//   // 🔗 Direct referrer
//   const directReferrer =
//     buyer.referalUser && (await isUserIdExists(buyer.referalUser))
//       ? await userModel
//           .findById(buyer.referalUser)
//           .select("firstName lastName mobile")
//       : adminUsers;

//   // ===========================
//   // 🔼 LEVEL USERS (UPSTREAM)
//   // ===========================
//   const getUpstreamUsers = async (startUserId, maxLevels) => {
//     const result = [];
//     let current = await userModel.findById(startUserId).select("parentId");
//     let level = 0;

//     while (current?.parentId && level < maxLevels) {
//       if (!(await isUserIdExists(current.parentId))) break;

//       const parent = await userModel
//         .findById(current.parentId)
//         .select("firstName lastName mobile parentId");

//       result.push({
//         userId: parent._id,
//         name: `${parent.firstName || ""} ${parent.lastName || ""}`.trim(),
//         mobile: parent.mobile,
//       });

//       current = parent;
//       level++;
//     }

//     return result;
//   };

//   // ===========================
//   // 🔁 IROT2 (UP + DOWN)
//   // ===========================
//   const getUpAndDownUsers = async (startUserId, maxLevels) => {
//     const visited = new Set();
//     const users = [];

//     const getChildren = async (ids, level = 0) => {
//       if (!ids.length || level >= maxLevels) return;

//       const children = await userModel
//         .find({ parentId: { $in: ids } })
//         .select("firstName lastName mobile _id");

//       for (const child of children) {
//         if (!visited.has(child._id.toString())) {
//           visited.add(child._id.toString());
//           users.push({
//             userId: child._id,
//             name: `${child.firstName || ""} ${child.lastName || ""}`.trim(),
//             mobile: child.mobile,
//           });
//         }
//       }

//       await getChildren(
//         children.map((c) => c._id),
//         level + 1
//       );
//     };

//     const upUsers = await getUpstreamUsers(startUserId, maxLevels);
//     users.push(...upUsers);
//     await getChildren([startUserId]);

//     return users;
//   };

//   // ===========================
//   // 🔗 IROT1 (REFERRAL CHAIN)
//   // ===========================
//   const getDirectReferralChain = async (startUserId, maxLevels) => {
//     const chain = [];
//     let currentId = startUserId;
//     let count = 0;

//     while (currentId && count < maxLevels) {
//       const user = await userModel.findById(currentId).select("referalUser");

//       if (!user?.referalUser) break;
//       if (!(await isUserIdExists(user.referalUser))) break;

//       const ref = await userModel
//         .findById(user.referalUser)
//         .select("firstName lastName mobile");

//       chain.push({
//         userId: ref._id,
//         name: `${ref.firstName || ""} ${ref.lastName || ""}`.trim(),
//         mobile: ref.mobile,
//       });

//       currentId = user.referalUser;
//       count++;
//     }

//     return chain;
//   };

//   // 🧮 Fetch chains
//   const levelUsers = await getUpstreamUsers(userId, 10);
//   const irot2Users = await getUpAndDownUsers(userId, 20);
//   const irot1Users = await getDirectReferralChain(userId, 10);

//   // ===========================
//   // 💸 Distribution helper
//   // ===========================
//   const calcDistribution = (users, percent, maxLevels) => {
//     const total = Number(((totalCashback * percent) / 100).toFixed(2));
//     const perUser = users.length ? Number((total / maxLevels).toFixed(2)) : 0;

//     const distributed = perUser * users.length;
//     const remaining = Number((total - distributed).toFixed(2));

//     const result = users.map((u) => ({ ...u, cashback: perUser }));

//     if (remaining > 0) {
//       result.push({ ...adminUsers, cashback: remaining });
//     }

//     return result;
//   };

//   const levelDistribution = calcDistribution(levelUsers, levelPercent, 10);
//   const irot1Distribution = calcDistribution(irot1Users, irot1Percent, 10);
//   const irot2Distribution = calcDistribution(irot2Users, irot2Percent, 20);

//   // ===========================
//   // 🔄 ROR
//   // ===========================
//   let rorReceiver = null;
//   if (
//     directReferrer?.referalUser &&
//     (await isUserIdExists(directReferrer.referalUser))
//   ) {
//     const rorUser = await userModel
//       .findById(directReferrer.referalUser)
//       .select("firstName lastName mobile");

//     rorReceiver = {
//       userId: rorUser._id,
//       name: `${rorUser.firstName || ""} ${rorUser.lastName || ""}`.trim(),
//       mobile: rorUser.mobile,
//       cashback: Number(((totalCashback * rorPercent) / 100).toFixed(2)),
//     };
//   } else {
//     rorReceiver = {
//       ...adminUsers,
//       cashback: Number(((totalCashback * rorPercent) / 100).toFixed(2)),
//     };
//   }

//   // ===========================
//   // ✅ FINAL RESPONSE
//   // ===========================
//   return {
//     cashbackReceivers: {
//       customer: {
//         userId: buyer._id,
//         name: `${buyer.firstName || ""} ${buyer.lastName || ""}`.trim(),
//         cashback: Number(((totalCashback * customerPercent) / 100).toFixed(2)),
//       },
//       referrer: directReferrer
//         ? {
//             userId: directReferrer._id,
//             name: `${directReferrer.firstName || ""} ${
//               directReferrer.lastName || ""
//             }`.trim(),
//             cashback: Number(
//               ((totalCashback * directReferralPercent) / 100).toFixed(2)
//             ),
//           }
//         : null,
//       shopkeeper: {
//         userId: refreshedShopkeeper._id,
//         name: `${refreshedShopkeeper.firstName || ""} ${
//           refreshedShopkeeper.lastName || ""
//         }`.trim(),
//         cashback: Number(
//           ((totalCashback * shopkeeperPercent) / 100).toFixed(2)
//         ),
//       },
//       superadmin: [
//         {
//           ...adminUsers,
//           cashback: Number(
//             ((totalCashback * superAdminPercent) / 100).toFixed(2)
//           ),
//         },
//       ],
//       admin: [
//         {
//           ...adminUsers,
//           cashback: Number(((totalCashback * adminPercent) / 100).toFixed(2)),
//         },
//       ],
//       levels: levelDistribution,
//       irot1: irot1Distribution,
//       irot2: irot2Distribution,
//       ror: {
//         totalROR: Number(((orderAmount * rorPercent) / 100).toFixed(2)),
//         percent: rorPercent,
//         receiver: rorReceiver,
//       },
//       totalCashback,
//     },
//     cashbackSummary: {
//       totalCashback,
//       customer: Number(((totalCashback * customerPercent) / 100).toFixed(2)),
//       referrer: Number(
//         ((totalCashback * directReferralPercent) / 100).toFixed(2)
//       ),
//       shopkeeper: Number(
//         ((totalCashback * shopkeeperPercent) / 100).toFixed(2)
//       ),
//       superadmin: Number(
//         ((totalCashback * superAdminPercent) / 100).toFixed(2)
//       ),
//       admin: Number(((totalCashback * adminPercent) / 100).toFixed(2)),
//       levels: levelDistribution.reduce((a, c) => a + c.cashback, 0),
//       irot1: irot1Distribution.reduce((a, c) => a + c.cashback, 0),
//       irot2: irot2Distribution.reduce((a, c) => a + c.cashback, 0),
//       ror: rorReceiver?.cashback || 0,
//     },
//   };
// };

// module.exports = calculateCashbackHelper;
const userModel = require("../models/userModel");
const businessModel = require("../models/businessModel");
const { isUserIdExists } = require("./commonQueries/commonQuerries");

const calculateCashbackHelper = async ({
  userId,
  shopkeeperId,
  orderAmount,
}) => {
  if (!userId || !shopkeeperId || !orderAmount) {
    return "Missing required fields for cashback calculation";
  }

  const isUser = await isUserIdExists(userId);

  if (!(await isUserIdExists(userId))) {
    return "Buyer does not exist";
  }

  if (!(await isUserIdExists(shopkeeperId))) {
    return "Shopkeeper does not exist";
  }

  const business = await businessModel
    .findOne({ shopkeeperId })
    .select("discountPercentage");
  if (!business) return "Shopkeeper not found";

  const cashbackPercent = business.discountPercentage || 0;
  const totalCashback = Number(
    ((orderAmount * cashbackPercent) / 100).toFixed(2)
  );

  // const adminUsers = await userModel
  //   .findOne({ role: "admin", status: "active" })
  //   .select("_id firstName lastName mobile");
  const result = await userModel
    .findOne({ role: "admin", status: "active" })
    .select("_id firstName lastName mobile");

  const adminUsers = {
    userId: result._id,
    firstName: result.firstName,
    lastName: result.lastName,
    mobile: result.mobile,
  };

  const buyer = await userModel.findById(userId);

  // 🔢 ENV percentages
  const customerPercent = Number(process.env.CUSTOMER_PERCENTAGE);
  const directReferralPercent = Number(process.env.REFERRER_PERCENTAGE);
  const rorPercent = Number(process.env.ROR_PERCENTAGE);
  const levelPercent = Number(process.env.LEVEL_PERCENTAGE);
  const irot1Percent = Number(process.env.IROT1_PERCENTAGE);
  const irot2Percent = Number(process.env.IROT2_PERCENTAGE);
  const shopkeeperPercent = Number(process.env.TIUP_PERCENTAGE);
  const superAdminPercent = Number(process.env.SUPERADMIN_PERCENTAGE);
  const adminPercent = Number(process.env.ADMIN);

  const hasValidDocs = buyer.aadhaarCardNumber && buyer.rationCardNumber;

  const shopkeeper = await userModel.findById(shopkeeperId);

  // 🔁 Shopkeeper referral (TIUP)
  let refreshedShopkeeper =
    shopkeeper?.referalUser && (await isUserIdExists(shopkeeper.referalUser))
      ? await userModel.findOne({
          _id: shopkeeper.referalUser,
          status: "active", // only active users
        })
      : adminUsers;

  // 🚫 If buyer docs missing → all to admin (UNCHANGED LOGIC)
  if (!hasValidDocs) {
    const customerCashback = Number(
      ((totalCashback * customerPercent) / 100).toFixed(2)
    );
    const tiupCashback = Number(
      ((totalCashback * shopkeeperPercent) / 100).toFixed(2)
    );

    return {
      cashbackReceivers: {
        customer: {
          userId: buyer._id,
          name: `${buyer.firstName || ""} ${buyer.lastName || ""}`.trim(),
          cashback: customerCashback,
        },
        referrer: null,
        shopkeeper: {
          userId: refreshedShopkeeper._id,
          name: `${refreshedShopkeeper.firstName || ""} ${
            refreshedShopkeeper.lastName || ""
          }`.trim(),
          cashback: tiupCashback,
        },
        superadmin: [
          {
            ...adminUsers,
            cashback: totalCashback - customerCashback - tiupCashback,
          },
        ],
        levels: [],
        irot1: [],
        irot2: [],
        ror: { totalROR: 0, percent: 0, receiver: null },
        totalCashback,
      },
      cashbackSummary: {
        totalCashback,
        customer: customerCashback,
        referrer: 0,
        shopkeeper: tiupCashback,
        superadmin: totalCashback - customerCashback - tiupCashback,
        levels: 0,
        irot1: 0,
        irot2: 0,
        ror: 0,
      },
    };
  }

  // 🔗 Direct referrer
  let directReferrer = { ...adminUsers, _id: adminUsers?.userId };

  if (buyer.referalUser && (await isUserIdExists(buyer.referalUser))) {
    const refUser = await userModel
      .findOne({
        _id: buyer.referalUser,
        status: "active", // only active users
      })
      .select(
        "firstName lastName mobile aadhaarCardNumber rationCardNumber referalUser"
      );

    const hasValidKyc =
      !!refUser?.aadhaarCardNumber && !!refUser?.rationCardNumber;

    if (hasValidKyc) {
      directReferrer = refUser;
    }
  }
  // ===========================
  // 🔼 LEVEL USERS (UPSTREAM)
  // ===========================

  const getUpstreamUsers = async (startUserId, maxLevels) => {
    const result = [];
    let current = await userModel
      .findOne({
        _id: startUserId,
        status: "active", // only active users
      })
      .select("parentId");

    let level = 0;

    while (current?.parentId && level < maxLevels) {
      if (!(await isUserIdExists(current.parentId))) break;

      const parent = await userModel
        .findOne({
          _id: current.parentId,
          status: "active", // only active users
        })
        .select(
          "firstName lastName mobile parentId aadhaarCardNumber rationCardNumber"
        );
      // 🔐 KYC CHECK
      const hasValidKyc =
        !!parent?.aadhaarCardNumber && !!parent?.rationCardNumber;

      // ❌ If KYC not valid → assign admin and STOP traversal
      if (!hasValidKyc) {
        result.push({
          userId: adminUsers.userId,
          name: `${adminUsers.firstName || ""} ${
            adminUsers.lastName || ""
          }`.trim(),
          mobile: adminUsers.mobile || null,
        });
        break;
      }

      // ✅ Valid upstream user
      result.push({
        userId: parent._id,
        name: `${parent.firstName || ""} ${parent.lastName || ""}`.trim(),
        mobile: parent.mobile,
      });

      current = parent;
      level++;
    }

    return result;
  };

  // ===========================
  // 🔁 IROT2 (UP + DOWN)
  // ===========================
  const getUpAndDownUsers = async (startUserId, maxLevels) => {
    const visited = new Set();
    const users = [];

    const getChildren = async (ids, level = 0) => {
      if (!ids.length || level >= maxLevels) return;

      const children = await userModel
        .find({ parentId: { $in: ids }, status: "active" })
        .select(
          "firstName lastName mobile _id aadhaarCardNumber rationCardNumber"
        );

      const validChildIds = [];

      for (const child of children) {
        const childId = child._id.toString();
        if (visited.has(childId)) continue;

        visited.add(childId);

        const hasValidKyc =
          !!child.aadhaarCardNumber && !!child.rationCardNumber;

        // ❌ Invalid KYC → Admin fallback
        if (!hasValidKyc) {
          users.push({
            userId: adminUsers.userId,
            name: `${adminUsers.firstName || ""} ${
              adminUsers.lastName || ""
            }`.trim(),
            mobile: adminUsers.mobile || null,
          });
          continue; // 🚫 do not traverse this branch
        }

        // ✅ Valid child
        users.push({
          userId: child._id,
          name: `${child.firstName || ""} ${child.lastName || ""}`.trim(),
          mobile: child.mobile,
        });

        validChildIds.push(child._id);
      }

      // 🔽 Traverse only valid KYC children
      await getChildren(validChildIds, level + 1);
    };

    // 🔼 Upstream (already KYC-safe)
    const upUsers = await getUpstreamUsers(startUserId, maxLevels);
    users.push(...upUsers);

    // 🔽 Downstream
    await getChildren([startUserId]);

    return users;
  };

  // ===========================
  // 🔗 IROT1 (REFERRAL CHAIN)
  // ===========================
  const getDirectReferralChain = async (startUserId, maxLevels) => {
    const chain = [];
    let currentId = startUserId;
    let count = 0;

    while (currentId && count < maxLevels) {
      const user = await userModel
        .findOne({
          _id: currentId,
          status: "active", // only active users
        })
        .select("referalUser");

      if (!user?.referalUser) break;
      if (!(await isUserIdExists(user.referalUser))) break;

      const ref = await userModel
        .findOne({
          _id: user.referalUser,
          status: "active", // only active users
        })
        .select("firstName lastName mobile aadhaarCardNumber rationCardNumber");

      const hasValidKyc = !!ref?.aadhaarCardNumber && !!ref?.rationCardNumber;

      if (!hasValidKyc) {
        // ❌ KYC missing → fallback to admin and stop the chain
        chain.push({
          userId: adminUsers.userId,
          name: `${adminUsers.firstName || ""} ${
            adminUsers.lastName || ""
          }`.trim(),
          mobile: adminUsers.mobile || null,
        });
        break;
      }

      // ✅ Valid referral
      chain.push({
        userId: ref._id,
        name: `${ref.firstName || ""} ${ref.lastName || ""}`.trim(),
        mobile: ref.mobile,
      });

      currentId = user.referalUser;
      count++;
    }

    return chain;
  };

  // 🧮 Fetch chains
  const levelUsers = await getUpstreamUsers(userId, 10);
  const irot2Users = await getUpAndDownUsers(userId, 20);
  const irot1Users = await getDirectReferralChain(userId, 10);

  // ===========================
  // 💸 Distribution helper
  // ===========================
  const calcDistribution = (users, percent, maxLevels) => {
    const total = Number(((totalCashback * percent) / 100).toFixed(2));
    const perUser = users.length ? Number((total / maxLevels).toFixed(2)) : 0;

    const distributed = perUser * users.length;
    const remaining = Number((total - distributed).toFixed(2));

    const result = users.map((u) => ({ ...u, cashback: perUser }));

    if (remaining > 0) {
      result.push({ ...adminUsers, cashback: remaining });
    }

    return result;
  };

  const levelDistribution = calcDistribution(levelUsers, levelPercent, 10);
  const irot1Distribution = calcDistribution(irot1Users, irot1Percent, 10);
  const irot2Distribution = calcDistribution(irot2Users, irot2Percent, 20);

  // ===========================
  // 🔄 ROR
  // ===========================
  let rorReceiver = null;

  if (
    directReferrer?.referalUser &&
    (await isUserIdExists(directReferrer.referalUser))
  ) {
    const rorUser = await userModel
      .findOne({
        _id: directReferrer.referalUser,
        status: "active",
      })
      .select("firstName lastName mobile aadhaarCardNumber rationCardNumber");

    const hasValidKyc =
      !!rorUser?.aadhaarCardNumber && !!rorUser?.rationCardNumber;

    if (hasValidKyc) {
      // ✅ Valid referral
      rorReceiver = {
        userId: rorUser._id,
        name: `${rorUser.firstName || ""} ${rorUser.lastName || ""} `.trim(),
        mobile: rorUser.mobile,
        cashback: Number(((totalCashback * rorPercent) / 100).toFixed(2)),
      };
    } else {
      // ❌ KYC missing → fallback to Admin
      rorReceiver = {
        userId: adminUsers.userId,
        name: `${adminUsers.firstName || ""} ${
          adminUsers.lastName || ""
        }`.trim(),
        mobile: adminUsers.mobile || null,
        cashback: Number(((totalCashback * rorPercent) / 100).toFixed(2)),
      };
    }
  } else {
    // ❌ No referalUser → fallback to Admin
    rorReceiver = {
      userId: adminUsers.userId,
      name: `${adminUsers.firstName || ""} ${adminUsers.lastName || ""}`.trim(),
      mobile: adminUsers.mobile || null,
      cashback: Number(((totalCashback * rorPercent) / 100).toFixed(2)),
    };
  }

  // ===========================
  // ✅ FINAL RESPONSE
  // ===========================
  return {
    cashbackReceivers: {
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
        userId: refreshedShopkeeper._id,
        name: `${refreshedShopkeeper.firstName || ""} ${
          refreshedShopkeeper.lastName || ""
        }`.trim(),
        cashback: Number(
          ((totalCashback * shopkeeperPercent) / 100).toFixed(2)
        ),
      },
      superadmin: [
        {
          ...adminUsers,
          cashback: Number(
            ((totalCashback * superAdminPercent) / 100).toFixed(2)
          ),
        },
      ],
      admin: [
        {
          ...adminUsers,
          cashback: Number(((totalCashback * adminPercent) / 100).toFixed(2)),
        },
      ],
      levels: levelDistribution,
      irot1: irot1Distribution,
      irot2: irot2Distribution,
      ror: {
        totalROR: Number(((orderAmount * rorPercent) / 100).toFixed(2)),
        percent: rorPercent,
        receiver: rorReceiver,
      },
      totalCashback,
    },
    cashbackSummary: {
      totalCashback,
      customer: Number(((totalCashback * customerPercent) / 100).toFixed(2)),
      referrer: Number(
        ((totalCashback * directReferralPercent) / 100).toFixed(2)
      ),
      shopkeeper: Number(
        ((totalCashback * shopkeeperPercent) / 100).toFixed(2)
      ),
      superadmin: Number(
        ((totalCashback * superAdminPercent) / 100).toFixed(2)
      ),
      admin: Number(((totalCashback * adminPercent) / 100).toFixed(2)),
      levels: levelDistribution.reduce((a, c) => a + c.cashback, 0),
      irot1: irot1Distribution.reduce((a, c) => a + c.cashback, 0),
      irot2: irot2Distribution.reduce((a, c) => a + c.cashback, 0),
      ror: rorReceiver?.cashback || 0,
    },
  };
};

module.exports = calculateCashbackHelper;
