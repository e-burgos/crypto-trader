-- CreateEnum
CREATE TYPE "EntryOrderMode"         AS ENUM ('MARKET','LIMIT_MAKER','OCO');
CREATE TYPE "EntryOrderStatus"       AS ENUM ('RESTING','FILLED','CANCELLED','EXPIRED','MISSING');
CREATE TYPE "EntryOrderLeg"          AS ENUM ('LIMIT','STOP');
CREATE TYPE "EntryOrderCancelReason" AS ENUM ('TTL_EXPIRED','LATER_DECISION','DAILY_LOSS_DISCARDED','BOT_STOPPED','REPLACED_BY_NEW_ENTRY','PARTIAL_FILL_REMAINDER','ORPHAN_SWEEP','VANISHED_ON_EXCHANGE');

-- CreateTable
CREATE TABLE "entry_orders" (
  "id"                 TEXT NOT NULL,
  "userId"             TEXT NOT NULL,
  "configId"           TEXT NOT NULL,
  "symbol"             TEXT NOT NULL,
  "asset"              "Asset" NOT NULL,
  "pair"               "QuoteCurrency" NOT NULL,
  "mode"               "TradingMode" NOT NULL,
  "entryMode"          "EntryOrderMode" NOT NULL,
  "status"             "EntryOrderStatus" NOT NULL DEFAULT 'RESTING',
  "quantity"           DOUBLE PRECISION NOT NULL,
  "limitPrice"         DOUBLE PRECISION NOT NULL,
  "stopPrice"          DOUBLE PRECISION,
  "stopLimitPrice"     DOUBLE PRECISION,
  "trailingDeltaBips"  INTEGER,
  "referencePrice"     DOUBLE PRECISION NOT NULL,
  "plannedNotionalUsd" DOUBLE PRECISION NOT NULL,
  "clientOrderId"      TEXT NOT NULL,
  "orderListId"        TEXT,
  "orderId"            TEXT,
  "limitLegOrderId"    TEXT,
  "stopLegOrderId"     TEXT,
  "placedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"          TIMESTAMP(3) NOT NULL,
  "decisionId"         TEXT,
  "positionId"         TEXT,
  "filledLeg"          "EntryOrderLeg",
  "executedPrice"      DOUBLE PRECISION,
  "executedQuantity"   DOUBLE PRECISION,
  "settledAt"          TIMESTAMP(3),
  "cancelReason"       "EntryOrderCancelReason",
  "lastError"          TEXT,
  "updatedAt"          TIMESTAMP(3) NOT NULL,
  CONSTRAINT "entry_orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "uk_entry_orders_client_order_id" ON "entry_orders" ("clientOrderId");
CREATE INDEX "idx_entry_orders_config_status"  ON "entry_orders" ("configId", "status");
CREATE INDEX "idx_entry_orders_user_status"    ON "entry_orders" ("userId", "status");
CREATE INDEX "idx_entry_orders_status_expires" ON "entry_orders" ("status", "expiresAt");

ALTER TABLE "entry_orders"
  ADD CONSTRAINT "entry_orders_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "entry_orders"
  ADD CONSTRAINT "entry_orders_configId_fkey"
  FOREIGN KEY ("configId") REFERENCES "trading_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
