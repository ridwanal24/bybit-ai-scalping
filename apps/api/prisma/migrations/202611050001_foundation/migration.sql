CREATE TABLE "app_metadata" (
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "app_metadata_pkey" PRIMARY KEY ("key")
);

INSERT INTO "app_metadata" ("key", "value") VALUES ('foundation_schema_version', '1');
