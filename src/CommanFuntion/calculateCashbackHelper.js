const userModel = require("../models/userModel");
const businessModel = require("../models/businessModel");
const { isUserIdExists } = require("./commonQueries/commonQuerries");

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
//   const totalCashback = parseFloat(
//     ((orderAmount * cashbackPercent) / 100).toFixed(2),
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
//   const customerPercent = parseInt(process.env.CUSTOMER_PERCENTAGE);
//   const directReferralPercent = parseInt(process.env.REFERRER_PERCENTAGE);
//   const rorPercent = parseInt(process.env.ROR_PERCENTAGE);
//   const levelPercent = parseInt(process.env.LEVEL_PERCENTAGE);
//   const irot1Percent = parseInt(process.env.IROT1_PERCENTAGE);
//   const irot2Percent = parseInt(process.env.IROT2_PERCENTAGE);
//   const shopkeeperPercent = parseInt(process.env.TIUP_PERCENTAGE);
//   const superAdminPercent = parseInt(process.env.SUPERADMIN_PERCENTAGE);
//   // const adminPercent = parseInt(process.env.ADMIN);

//   const hasValidDocs = buyer.aadhaarCardNumber && buyer.rationCardNumber;

//   const shopkeeper = await userModel.findById(shopkeeperId);

//   // 🔁 Shopkeeper referral (TIUP)
//   let refreshedShopkeeper =
//     shopkeeper?.referalUser && (await isUserIdExists(shopkeeper.referalUser))
//       ? await userModel.findOne({
//           _id: shopkeeper.referalUser,
//           status: "active", // only active users
//         })
//       : adminUsers;

//   // 🚫 If buyer docs missing → all to admin (UNCHANGED LOGIC)
//   if (!hasValidDocs) {
//     const customerCashback = parseFloat(
//       (totalCashback * customerPercent) / 100,
//     );
//     const tiupCashback = parseFloat((totalCashback * shopkeeperPercent) / 100);

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
//   let directReferrer = { ...adminUsers, _id: adminUsers?.userId };

//   if (buyer.referalUser && (await isUserIdExists(buyer.referalUser))) {
//     const refUser = await userModel
//       .findOne({
//         _id: buyer.referalUser,
//         status: "active", // only active users
//       })
//       .select(
//         "firstName lastName mobile aadhaarCardNumber rationCardNumber referalUser",
//       );

//     const hasValidKyc =
//       !!refUser?.aadhaarCardNumber && !!refUser?.rationCardNumber;

//     if (hasValidKyc) {
//       directReferrer = refUser;
//     }
//   }
//   // ===========================
//   // 🔼 LEVEL USERS (UPSTREAM)
//   // ===========================

//   const getUpstreamUsers = async (startUserId, maxLevels) => {
//     const result = [];
//     let current = await userModel
//       .findOne({
//         _id: startUserId,
//         status: "active", // only active users
//       })
//       .select("parentId");

//     let level = 0;

//     while (current?.parentId && level < maxLevels) {
//       if (!(await isUserIdExists(current.parentId))) break;

//       const parent = await userModel
//         .findOne({
//           _id: current.parentId,
//           status: "active", // only active users
//         })
//         .select(
//           "firstName lastName mobile parentId aadhaarCardNumber rationCardNumber",
//         );
//       // 🔐 KYC CHECK
//       const hasValidKyc =
//         !!parent?.aadhaarCardNumber && !!parent?.rationCardNumber;

//       // ❌ If KYC not valid → assign admin and STOP traversal
//       if (!hasValidKyc) {
//         result.push({
//           userId: adminUsers.userId,
//           name: `${adminUsers.firstName || ""} ${
//             adminUsers.lastName || ""
//           }`.trim(),
//           mobile: adminUsers.mobile || null,
//         });
//       } else {
//         // ✅ Valid upstream user
//         result.push({
//           userId: parent._id,
//           name: `${parent.firstName || ""} ${parent.lastName || ""}`.trim(),
//           mobile: parent.mobile,
//         });
//       }

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
//         .find({ parentId: { $in: ids }, status: "active" })
//         .select(
//           "firstName lastName mobile _id aadhaarCardNumber rationCardNumber",
//         );

//       const validChildIds = [];

//       for (const child of children) {
//         const childId = child._id.toString();
//         if (visited.has(childId)) continue;

//         visited.add(childId);

//         const hasValidKyc =
//           !!child.aadhaarCardNumber && !!child.rationCardNumber;

//         // ❌ Invalid KYC → Admin fallback
//         if (!hasValidKyc) {
//           users.push({
//             userId: adminUsers.userId,
//             name: `${adminUsers.firstName || ""} ${
//               adminUsers.lastName || ""
//             }`.trim(),
//             mobile: adminUsers.mobile || null,
//           });
//           continue; // 🚫 do not traverse this branch
//         }

//         // ✅ Valid child
//         users.push({
//           userId: child._id,
//           name: `${child.firstName || ""} ${child.lastName || ""}`.trim(),
//           mobile: child.mobile,
//         });

//         validChildIds.push(child._id);
//       }

//       // 🔽 Traverse only valid KYC children
//       await getChildren(validChildIds, level + 1);
//     };

//     // 🔼 Upstream (already KYC-safe)
//     const upUsers = await getUpstreamUsers(startUserId, maxLevels);
//     users.push(...upUsers);

//     // 🔽 Downstream
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
//       const user = await userModel
//         .findOne({
//           _id: currentId,
//           status: "active", // only active users
//         })
//         .select("referalUser");

//       if (!user?.referalUser) break;
//       if (!(await isUserIdExists(user.referalUser))) break;

//       const ref = await userModel
//         .findOne({
//           _id: user.referalUser,
//           status: "active", // only active users
//         })
//         .select("firstName lastName mobile aadhaarCardNumber rationCardNumber");

//       const hasValidKyc = !!ref?.aadhaarCardNumber && !!ref?.rationCardNumber;

//       if (!hasValidKyc) {
//         // ❌ KYC missing → fallback to admin and stop the chain
//         chain.push({
//           userId: adminUsers.userId,
//           name: `${adminUsers.firstName || ""} ${
//             adminUsers.lastName || ""
//           }`.trim(),
//           mobile: adminUsers.mobile || null,
//         });
//       } else {
//         // ✅ Valid referral
//         chain.push({
//           userId: ref._id,
//           name: `${ref.firstName || ""} ${ref.lastName || ""}`.trim(),
//           mobile: ref.mobile,
//         });
//       }

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
//     const total = parseFloat((totalCashback * percent) / 100);
//     const perUser = users.length ? parseFloat(total / maxLevels) : 0;

//     const distributed = perUser * users.length;
//     const remaining = parseFloat(total - distributed);

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
//       .findOne({
//         _id: directReferrer.referalUser,
//         status: "active",
//       })
//       .select("firstName lastName mobile aadhaarCardNumber rationCardNumber");

//     const hasValidKyc =
//       !!rorUser?.aadhaarCardNumber && !!rorUser?.rationCardNumber;

//     if (hasValidKyc) {
//       // ✅ Valid referral
//       rorReceiver = {
//         userId: rorUser._id,
//         name: `${rorUser.firstName || ""} ${rorUser.lastName || ""} `.trim(),
//         mobile: rorUser.mobile,
//         cashback: parseFloat((totalCashback * rorPercent) / 100),
//       };
//     } else {
//       // ❌ KYC missing → fallback to Admin
//       rorReceiver = {
//         userId: adminUsers.userId,
//         name: `${adminUsers.firstName || ""} ${
//           adminUsers.lastName || ""
//         }`.trim(),
//         mobile: adminUsers.mobile || null,
//         cashback: parseFloat((totalCashback * rorPercent) / 100),
//       };
//     }
//   } else {
//     // ❌ No referalUser → fallback to Admin
//     rorReceiver = {
//       userId: adminUsers.userId,
//       name: `${adminUsers.firstName || ""} ${adminUsers.lastName || ""}`.trim(),
//       mobile: adminUsers.mobile || null,
//       cashback: parseFloat((totalCashback * rorPercent) / 100),
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
//         cashback: parseFloat((totalCashback * customerPercent) / 100),
//       },
//       referrer: directReferrer
//         ? {
//             userId: directReferrer._id,
//             name: `${directReferrer.firstName || ""} ${
//               directReferrer.lastName || ""
//             }`.trim(),
//             cashback: parseFloat((totalCashback * directReferralPercent) / 100),
//           }
//         : null,
//       shopkeeper: {
//         userId: refreshedShopkeeper._id,
//         name: `${refreshedShopkeeper.firstName || ""} ${
//           refreshedShopkeeper.lastName || ""
//         }`.trim(),
//         cashback: parseFloat((totalCashback * shopkeeperPercent) / 100),
//       },
//       superadmin: [
//         {
//           ...adminUsers,
//           cashback: parseFloat((totalCashback * superAdminPercent) / 100),
//         },
//       ],
//       // admin: [
//       //   {
//       //     ...adminUsers,
//       //     cashback: parseFloat((totalCashback * adminPercent) / 100),
//       //   },
//       // ],
//       levels: levelDistribution,
//       irot1: irot1Distribution,
//       irot2: irot2Distribution,
//       ror: {
//         totalROR: parseFloat((orderAmount * rorPercent) / 100),
//         percent: rorPercent,
//         receiver: rorReceiver,
//       },
//       totalCashback,
//     },
//     cashbackSummary: {
//       totalCashback,
//       customer: parseFloat((totalCashback * customerPercent) / 100),
//       referrer: parseFloat((totalCashback * directReferralPercent) / 100),
//       shopkeeper: parseFloat((totalCashback * shopkeeperPercent) / 100),
//       superadmin: parseFloat((totalCashback * superAdminPercent) / 100),
//       // admin: parseFloat((totalCashback * adminPercent) / 100),
//       levels: levelDistribution.reduce((a, c) => a + c.cashback, 0),
//       irot1: irot1Distribution.reduce((a, c) => a + c.cashback, 0),
//       irot2: irot2Distribution.reduce((a, c) => a + c.cashback, 0),
//       ror: rorReceiver?.cashback || 0,
//     },
//   };
// };

const calculateCashbackHelper = async ({
  userId,
  shopkeeperId,
  orderAmount,
}) => {
  if (!userId || !shopkeeperId || !orderAmount) {
    return "Missing required fields for cashback calculation";
  }

  const isUserExists = async (id) =>
    !!(await userModel.exists({ _id: id, status: "active" }));

  if (!(await isUserExists(userId))) return "Buyer does not exist";
  if (!(await isUserExists(shopkeeperId))) return "Shopkeeper does not exist";

  const business = await businessModel
    .findOne({ shopkeeperId })
    .select("discountPercentage");
  if (!business) return "Shopkeeper not found";

  const cashbackPercent = business.discountPercentage || 0;
  const totalCashback = parseFloat(
    ((orderAmount * cashbackPercent) / 100).toFixed(2),
  );

  // Admin user
  const adminResult = await userModel
    .findOne({ role: "admin", status: "active" })
    .select("_id firstName lastName mobile");

  const adminUsers = {
    userId: adminResult._id,
    firstName: adminResult.firstName,
    lastName: adminResult.lastName,
    mobile: adminResult.mobile,
  };

  const buyer = await userModel.findById(userId);
  const shopkeeper = await userModel.findById(shopkeeperId);

  // ENV percentages
  const customerPercent = parseInt(process.env.CUSTOMER_PERCENTAGE);
  const directReferralPercent = parseInt(process.env.REFERRER_PERCENTAGE);
  const rorPercent = parseInt(process.env.ROR_PERCENTAGE);
  const levelPercent = parseInt(process.env.LEVEL_PERCENTAGE);
  const irot1Percent = parseInt(process.env.IROT1_PERCENTAGE);
  const irot2Percent = parseInt(process.env.IROT2_PERCENTAGE);
  const shopkeeperPercent = parseInt(process.env.TIUP_PERCENTAGE);
  const superAdminPercent = parseInt(process.env.SUPERADMIN_PERCENTAGE);

  const hasValidDocs = buyer.aadhaarCardNumber && buyer.rationCardNumber;

  // Shopkeeper referral (TIUP)
  let refreshedShopkeeper =
    shopkeeper?.referalUser && (await isUserExists(shopkeeper.referalUser))
      ? await userModel.findOne({
          _id: shopkeeper.referalUser,
          status: "active",
        })
      : adminUsers;

  // 🚫 If buyer docs missing → all to admin
  if (!hasValidDocs) {
    const customerCashback = parseFloat(
      (totalCashback * customerPercent) / 100,
    );
    const tiupCashback = parseFloat((totalCashback * shopkeeperPercent) / 100);

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
          name: `${refreshedShopkeeper.firstName || ""} ${refreshedShopkeeper.lastName || ""}`.trim(),
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
      lapIncome: {},
    };
  }

  // Direct referrer
  let directReferrer = { ...adminUsers, _id: adminUsers?.userId };

  if (buyer.referalUser && (await isUserExists(buyer.referalUser))) {
    const refUser = await userModel
      .findOne({ _id: buyer.referalUser, status: "active" })
      .select(
        "firstName lastName mobile aadhaarCardNumber rationCardNumber referalUser",
      );

    const hasValidKyc =
      !!refUser?.aadhaarCardNumber && !!refUser?.rationCardNumber;
    if (hasValidKyc) directReferrer = refUser;
  }

  // ===========================
  // 🔼 LEVEL USERS (UPSTREAM)
  // ===========================
  const getUpstreamUsers = async (startUserId, maxLevels) => {
    const result = [];
    const lapIncome = [];

    let current = await userModel
      .findOne({ _id: startUserId, status: "active" })
      .select("parentId");

    let level = 0;

    while (current?.parentId && level < maxLevels) {
      const parent = await userModel
        .findOne({ _id: current.parentId, status: "active" })
        .select(
          "firstName lastName mobile parentId aadhaarCardNumber rationCardNumber levelId",
        );

      if (!parent) break;

      const hasValidKyc =
        !!parent?.aadhaarCardNumber && !!parent?.rationCardNumber;

      if (!hasValidKyc) {
        lapIncome.push({
          skippedUserId: parent._id,
          level,
          name: `${parent.firstName || ""} ${parent.lastName || ""}`.trim(),
        });

        current = parent;
        level++;
        continue;
      }

      result.push({
        userId: parent._id,
        name: `${parent.firstName || ""} ${parent.lastName || ""}`.trim(),
        mobile: parent.mobile,
        level: parent.levelId,
      });

      current = parent;
      level++;
    }

    // ================================
    // 🔥 NEW FIX: Remaining Levels → Admin
    // ================================
    const remainingLevels = maxLevels - level;

    if (remainingLevels > 0) {
      for (let i = 0; i < remainingLevels; i++) {
        // lapIncome.push({
        //   skippedUserId: null,
        //   level: level + i,
        //   name: "No User (Level Missing)",
        // });

        // mark for redistribution
        result.push({ redistribute: true });
      }
    }

    // ================================
    // Redistribute logic
    // ================================
    if (lapIncome.length && result.length) {
      // already handled via redistribute markers
    } else if (lapIncome.length && result.length === 0) {
      result.push({ ...adminUsers });
    }

    return { result, lapIncome };
  };

  // ===========================
  // 🔁 IROT2 (UP + DOWN)
  // ===========================
  const getUpAndDownUsers = async (startUserId, maxLevels) => {
    const visited = new Set();
    const users = [];
    const lapIncome = [];

    const getChildren = async (ids, level = 0) => {
      if (!ids.length || level >= maxLevels) return;

      const children = await userModel
        .find({ parentId: { $in: ids }, status: "active" })
        .select(
          "firstName lastName mobile _id aadhaarCardNumber rationCardNumber levelId",
        );

      const validChildIds = [];

      for (const child of children) {
        const childId = child._id.toString();
        if (visited.has(childId)) continue;
        visited.add(childId);

        const hasValidKyc =
          !!child.aadhaarCardNumber && !!child.rationCardNumber;
        if (!hasValidKyc) {
          lapIncome.push({
            skippedUserId: child._id,
            level,
            name: `${child.firstName || ""} ${child.lastName || ""}`.trim(),
          });
          const grandChildren = await userModel.find({
            parentId: child._id,
            status: "active",
          });
          if (grandChildren.length)
            validChildIds.push(...grandChildren.map((g) => g._id));
          else users.push({ ...adminUsers });
          continue;
        }

        users.push({
          userId: child._id,
          name: `${child.firstName || ""} ${child.lastName || ""}`.trim(),
          mobile: child.mobile,
          level: child.levelId,
        });

        validChildIds.push(child._id);
      }

      await getChildren(validChildIds, level + 1);
    };

    const { result: upUsers, lapIncome: upLap } = await getUpstreamUsers(
      startUserId,
      maxLevels,
    );
    users.push(...upUsers);
    lapIncome.push(...upLap);

    await getChildren([startUserId]);

    return { users, lapIncome };
  };

  // ===========================
  // 🔗 IROT1 (REFERRAL CHAIN)
  // ===========================
  const getDirectReferralChain = async (startUserId, maxLevels) => {
    const chain = [];
    const lapIncome = [];
    let currentId = startUserId;
    let count = 0;

    while (currentId && count < maxLevels) {
      const user = await userModel
        .findOne({ _id: currentId, status: "active" })
        .select("referalUser");
      if (!user?.referalUser || !(await isUserExists(user.referalUser))) break;

      const ref = await userModel
        .findOne({ _id: user.referalUser, status: "active" })
        .select(
          "firstName lastName mobile aadhaarCardNumber rationCardNumber referalUser levelId",
        );

      const hasValidKyc = !!ref?.aadhaarCardNumber && !!ref?.rationCardNumber;

      if (!hasValidKyc) {
        lapIncome.push({
          skippedUserId: ref._id,
          level: count,
          name: `${ref.firstName || ""} ${ref.lastName || ""}`.trim(),
        });
        if (ref?.referalUser && (await isUserExists(ref.referalUser))) {
          currentId = ref.referalUser;
          count++;
          continue;
        } else {
          chain.push({ ...adminUsers });
          break;
        }
      }

      chain.push({
        userId: ref._id,
        name: `${ref.firstName || ""} ${ref.lastName || ""}`.trim(),
        mobile: ref.mobile,
        level: ref.levelId,
      });

      currentId = user.referalUser;
      count++;
    }

    return { chain, lapIncome };
  };

  // ===========================
  // 💸 Distribution helper
  // ===========================
  const calcDistribution = (users, percent, maxLevels) => {
    const total = parseFloat((totalCashback * percent) / 100);

    const validUsers = users.filter((u) => !u.redistribute);
    const redistributeUsers = users.filter((u) => u.redistribute);

    const perUser = validUsers.length ? parseFloat(total / users.length) : 0;

    let adminExtra = 0;

    const result = users.map((u) => {
      if (u.redistribute) {
        // ✅ send this amount to admin
        adminExtra += u.cashback;
        return { ...u, cashback: 0 };
      }

      return { ...u, cashback: perUser };
    });

    const distributed = perUser * validUsers.length;
    const remaining = parseFloat(total - distributed);

    const finalAdminAmount = parseFloat(adminExtra || 0 + remaining);

    if (finalAdminAmount > 0) {
      result.push({ ...adminUsers, cashback: finalAdminAmount });
    }

    return {
      distributedUsers: result,
      perLevelAmount: total / maxLevels,
    };
  };

  // ===========================
  // 🧮 Fetch all chains
  // ===========================
  const { result: levelUsers, lapIncome: levelLap } = await getUpstreamUsers(
    userId,
    10,
  );

  const { result: irot2Users, lapIncome: irot2Lap } = await getUpstreamUsers(
    userId,
    20,
  );
  const { chain: irot1Users, lapIncome: irot1Lap } =
    await getDirectReferralChain(userId, 10);

  const {
    distributedUsers: levelCashbackusers,
    perLevelAmount: levelPerAmount,
  } = calcDistribution(levelUsers, levelPercent, 10);

  const {
    distributedUsers: irot1Cashbackusers,
    perLevelAmount: irot1PerAmount,
  } = calcDistribution(irot1Users, irot1Percent, 10);

  const {
    distributedUsers: irot2Cashbackusers,
    perLevelAmount: irot2PerAmount,
  } = calcDistribution(irot2Users, irot2Percent, 20);

  // ===========================
  // 🔄 ROR
  // ===========================
  let rorReceiver = null;
  if (
    directReferrer?.referalUser &&
    (await isUserExists(directReferrer.referalUser))
  ) {
    const rorUser = await userModel
      .findOne({ _id: directReferrer.referalUser, status: "active" })
      .select("firstName lastName mobile aadhaarCardNumber rationCardNumber");

    const hasValidKyc =
      !!rorUser?.aadhaarCardNumber && !!rorUser?.rationCardNumber;

    rorReceiver = hasValidKyc
      ? {
          userId: rorUser._id,
          name: `${rorUser.firstName || ""} ${rorUser.lastName || ""}`.trim(),
          mobile: rorUser.mobile,
          cashback: parseFloat((totalCashback * rorPercent) / 100),
        }
      : {
          ...adminUsers,
          cashback: parseFloat((totalCashback * rorPercent) / 100),
        };
  } else
    rorReceiver = {
      ...adminUsers,
      cashback: parseFloat((totalCashback * rorPercent) / 100),
    };

  // ===========================
  // ✅ FINAL RESPONSE
  // ===========================
  return {
    cashbackReceivers: {
      customer: {
        userId: buyer._id,
        name: `${buyer.firstName || ""} ${buyer.lastName || ""}`.trim(),
        cashback: parseFloat((totalCashback * customerPercent) / 100),
      },
      referrer: {
        userId: directReferrer._id,
        name: `${directReferrer.firstName || ""} ${directReferrer.lastName || ""}`.trim(),
        cashback: parseFloat((totalCashback * directReferralPercent) / 100),
      },
      shopkeeper: {
        userId: refreshedShopkeeper._id,
        name: `${refreshedShopkeeper.firstName || ""} ${refreshedShopkeeper.lastName || ""}`.trim(),
        cashback: parseFloat((totalCashback * shopkeeperPercent) / 100),
      },
      superadmin: [
        {
          ...adminUsers,
          cashback: parseFloat((totalCashback * superAdminPercent) / 100),
        },
      ],
      levels: levelCashbackusers,
      irot1: irot1Cashbackusers,
      irot2: irot2Cashbackusers,
      ror: {
        totalROR: parseFloat((orderAmount * rorPercent) / 100),
        percent: rorPercent,
        receiver: rorReceiver,
      },
      totalCashback,
    },
    cashbackSummary: {
      totalCashback,
      customer: parseFloat((totalCashback * customerPercent) / 100),
      referrer: parseFloat((totalCashback * directReferralPercent) / 100),
      shopkeeper: parseFloat((totalCashback * shopkeeperPercent) / 100),
      superadmin: parseFloat((totalCashback * superAdminPercent) / 100),
      levels: levelCashbackusers.reduce((a, c) => a + (c.cashback || 0), 0),
      irot1: irot1Cashbackusers.reduce((a, c) => a + (c.cashback || 0), 0),
      irot2: irot2Cashbackusers.reduce((a, c) => a + (c.cashback || 0), 0),
      ror: rorReceiver?.cashback || 0,
    },
    lapIncome: [
      ...levelLap.map((item) => ({
        ...item,
        chain: "level",
        amount: levelPerAmount,
      })),
      ...irot1Lap.map((item) => ({
        ...item,
        chain: "irot1",
        amount: irot1PerAmount,
      })),
      ...irot2Lap.map((item) => ({
        ...item,
        chain: "irot2",
        amount: irot2PerAmount,
      })),
    ],
  };
};

module.exports = calculateCashbackHelper;
