import { daysAgo } from "./data";
import type { CropId } from "./types";

/** Commission = 30% of developer share (BR R-9). Developer share modelled at 50% of ৳5. */
export const DEALER_COMMISSION_RATE = 0.3;
export const DEV_SHARE_PER_RX = 2.5;
export const COMMISSION_PER_RX = DEV_SHARE_PER_RX * DEALER_COMMISSION_RATE;

export type DealerSale = {
  ref: string;
  at: string;
  crop: CropId;
  diseaseCode: string;
  farmer: string; // masked
  status: "PAID" | "DELIVERED" | "FAILED" | "DISPUTED";
  commission: number;
};

export const DEALER_SALES: DealerSale[] = [
  { ref: "PD-483120", at: daysAgo(0, 11), crop: "rice", diseaseCode: "RICE_BLAST", farmer: "019••••2210", status: "DELIVERED", commission: COMMISSION_PER_RX },
  { ref: "PD-483066", at: daysAgo(0, 10), crop: "rice", diseaseCode: "RICE_BLB", farmer: "014••••7781", status: "DELIVERED", commission: COMMISSION_PER_RX },
  { ref: "PD-482998", at: daysAgo(0, 9), crop: "potato", diseaseCode: "POTATO_LATE_BLIGHT", farmer: "019••••0453", status: "PAID", commission: COMMISSION_PER_RX },
  { ref: "PD-482871", at: daysAgo(1, 17), crop: "rice", diseaseCode: "RICE_BROWN_SPOT", farmer: "019••••3349", status: "DELIVERED", commission: COMMISSION_PER_RX },
  { ref: "PD-482790", at: daysAgo(1, 12), crop: "tomato", diseaseCode: "TOMATO_EARLY_BLIGHT", farmer: "019••••8812", status: "FAILED", commission: 0 },
  { ref: "PD-482655", at: daysAgo(2, 15), crop: "rice", diseaseCode: "RICE_BLAST", farmer: "014••••1029", status: "DELIVERED", commission: COMMISSION_PER_RX },
  { ref: "PD-482410", at: daysAgo(3, 10), crop: "potato", diseaseCode: "POTATO_EARLY_BLIGHT", farmer: "019••••6650", status: "DELIVERED", commission: COMMISSION_PER_RX },
  { ref: "PD-482301", at: daysAgo(4, 11), crop: "rice", diseaseCode: "RICE_SHEATH_BLIGHT", farmer: "019••••4471", status: "DISPUTED", commission: 0 },
  { ref: "PD-482122", at: daysAgo(6, 9), crop: "rice", diseaseCode: "RICE_BLAST", farmer: "019••••9033", status: "DELIVERED", commission: COMMISSION_PER_RX },
];

export const DEALER_STATS = {
  todaySales: 3,
  todayCommission: 3 * COMMISSION_PER_RX,
  monthSales: 64,
  monthCommission: 64 * COMMISSION_PER_RX,
  monthDiagnoses: 91,
  lastPayout: { month: "2026-10", amount: 38.25, paidOn: "2026-11-05" },
};

/** Daily paid prescriptions for the last 14 days, oldest first. */
export const DEALER_DAILY = [2, 1, 3, 4, 2, 0, 3, 5, 4, 3, 6, 2, 4, 3];
