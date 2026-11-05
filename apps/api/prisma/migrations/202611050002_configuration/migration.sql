CREATE TABLE "research_configurations" (
  "id" UUID PRIMARY KEY,
  "name" TEXT NOT NULL CHECK (length("name") BETWEEN 1 AND 120),
  "payload" JSONB NOT NULL CHECK (jsonb_typeof("payload") = 'object'),
  "schema_version" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1 CHECK ("revision" > 0),
  "config_hash" CHAR(64) NOT NULL CHECK ("config_hash" ~ '^[0-9a-f]{64}$'),
  "provenance" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "research_configurations_created_at_id_idx" ON "research_configurations"("created_at", "id");

CREATE TABLE "configuration_snapshots" (
  "id" UUID PRIMARY KEY,
  "source_configuration_id" UUID NOT NULL,
  "source_revision" INTEGER NOT NULL CHECK ("source_revision" > 0),
  "payload" JSONB NOT NULL CHECK (jsonb_typeof("payload") = 'object'),
  "schema_version" TEXT NOT NULL,
  "config_hash" CHAR(64) NOT NULL CHECK ("config_hash" ~ '^[0-9a-f]{64}$'),
  "provenance" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "configuration_snapshots_source_fkey" FOREIGN KEY ("source_configuration_id")
    REFERENCES "research_configurations"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "configuration_snapshot_source_revision_key"
    UNIQUE ("source_configuration_id", "source_revision")
);

CREATE FUNCTION prevent_configuration_snapshot_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Configuration snapshots are immutable' USING ERRCODE = '55000';
END;
$$;
CREATE TRIGGER configuration_snapshot_no_change
  BEFORE UPDATE OR DELETE ON "configuration_snapshots"
  FOR EACH ROW EXECUTE FUNCTION prevent_configuration_snapshot_mutation();
CREATE TRIGGER configuration_snapshot_no_truncate
  BEFORE TRUNCATE ON "configuration_snapshots"
  FOR EACH STATEMENT EXECUTE FUNCTION prevent_configuration_snapshot_mutation();

INSERT INTO "app_metadata" ("key", "value") VALUES ('configuration_schema_version', '1');
