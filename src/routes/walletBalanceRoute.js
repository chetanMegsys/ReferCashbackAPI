const express = require("express");
const Router = express.Router();
const WalletBalancesController = require("../controllers/walletBalanceController");

Router.post("/withdrawRequest", WalletBalancesController.withdrawRequest);
Router.post("/addWalletBalance", WalletBalancesController.addWalletBalance);
Router.post(
  "/getWithdrawRequests",
  WalletBalancesController.getWithdrawRequests,
);
Router.post(
  "/approveRejecteWithdrawRequest",
  WalletBalancesController.approveRejecteWithdrawRequest,
);
Router.post(
  "/deductWalletBalance",
  WalletBalancesController.deductWalletBalance,
);
Router.post(
  "/createDepositRequest",
  WalletBalancesController.createDepositRequest,
);
Router.post("/getDepositRequests", WalletBalancesController.getDepositRequests);
Router.post(
  "/approveRejecteDepositRequest",
  WalletBalancesController.approveRejecteDepositRequest,
);

module.exports = Router;
