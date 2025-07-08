export const COMPANY_CODES = [
  { value: "COMP001", label: "ABC Corporation" },
  { value: "COMP002", label: "XYZ Industries" },
  { value: "COMP003", label: "Global Enterprises" },
]

export const SITE_CODES = [
  { value: "SITE001", label: "New York HQ" },
  { value: "SITE002", label: "London Office" },
  { value: "SITE003", label: "Tokyo Branch" },
]

export const PERIODS = ["P1-2024", "P2-2024", "P3-2024", "P4-2024", "P1-2025", "P2-2025", "P3-2025", "P4-2025"]

export const ACCOUNTS = [
  { value: "TOTAL_REVENUE", label: "TOTAL REVENUE (Aggregated)", isAggregated: true },
  { value: "FOOD_PURCHASES", label: "Food Purchases (Non-Aggregated)", isAggregated: false },
]

export const AGGREGATED_ACCOUNT_DATA = {
  accountType: "Aggregated",
  subAccount: "TOTAL REVENUE",
  isAggregated: true,
  percentageField: '[{"Denominator Accounts":[{"Description":"Revenue - Beverages","GLCode":"1"}]}]',
  periods: {
    "P1-2025": 434504,
    "P1-2025 %": 259.36,
    "P2-2025": 531503,
    "P2-2025 %": 272.21,
    "P3-2025": 693682,
    "P3-2025 %": 275.03,
    "P4-2025": 544345,
    "P4-2025 %": 287.89,
  },
  aggregatedFields: [
    {
      subAccount: "Revenue - Food",
      accountType: "Income",
      percentageField: "1 - Revenue - Beverages",
      periods: {
        "P1-2025": 266917,
        "P1-2025 %": 159.36,
        "P2-2025": 335337,
        "P2-2025 %": 172.21,
        "P3-2025": 441401,
        "P3-2025 %": 175.03,
        "P4-2025": 355067,
        "P4-2025 %": 187.89,
      },
    },
    {
      subAccount: "Revenue - Tea/Coffee",
      accountType: "Income",
      percentageField: "1 - Revenue - Beverages",
      periods: {
        "P1-2025": 2186,
        "P1-2025 %": 1.31,
        "P2-2025": 2157,
        "P2-2025 %": 1.11,
        "P3-2025": 3538,
        "P3-2025 %": 1.4,
        "P4-2025": 2422,
        "P4-2025 %": 1.28,
      },
    },
    {
      subAccount: "Revenue - Wines",
      accountType: "Income",
      percentageField: "1 - Revenue - Beverages",
      periods: {
        "P1-2025": 80170,
        "P1-2025 %": 47.86,
        "P2-2025": 88332,
        "P2-2025 %": 45.36,
        "P3-2025": 113348,
        "P3-2025 %": 44.95,
        "P4-2025": 82357,
        "P4-2025 %": 43.58,
      },
    },
    {
      subAccount: "Revenue - Liquor",
      accountType: "Income",
      percentageField: "1 - Revenue - Beverages",
      periods: {
        "P1-2025": 73434,
        "P1-2025 %": 43.84,
        "P2-2025": 89426,
        "P2-2025 %": 45.92,
        "P3-2025": 117492,
        "P3-2025 %": 46.59,
        "P4-2025": 89146,
        "P4-2025 %": 47.17,
      },
    },
    {
      subAccount: "Revenue - Other Beverages",
      accountType: "Income",
      percentageField: "1 - Revenue - Beverages",
      periods: {
        "P1-2025": 11708,
        "P1-2025 %": 6.99,
        "P2-2025": 14811,
        "P2-2025 %": 7.61,
        "P3-2025": 17813,
        "P3-2025 %": 7.06,
        "P4-2025": 15049,
        "P4-2025 %": 7.96,
      },
    },
    {
      subAccount: "Revenue - Retails",
      accountType: "Income",
      percentageField: "1 - Revenue - Beverages",
      periods: {
        "P1-2025": 90,
        "P1-2025 %": 0.05,
        "P2-2025": 1440,
        "P2-2025 %": 0.74,
        "P3-2025": 90,
        "P3-2025 %": 0.04,
        "P4-2025": 305,
        "P4-2025 %": 0.16,
      },
    },
  ],
}

export const NON_AGGREGATED_ACCOUNT_DATA = {
  accountType: "CostOfGoodsSold",
  subAccount: "Food Purchases",
  isAggregated: false,
  percentageField: '[{"Denominator Accounts":[{"Description":"Revenue - Food","GLCode":"300-010"}]}]',
  periods: {
    "P1-2025": 66711,
    "P1-2025 %": 24.99,
    "P2-2025": 81187,
    "P2-2025 %": 24.21,
    "P3-2025": 106116,
    "P3-2025 %": 24.04,
    "P4-2025": 80126,
    "P4-2025 %": 22.56,
  },
}
