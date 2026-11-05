CREATE TABLE instrument_observations (
  id UUID PRIMARY KEY, source TEXT NOT NULL, symbol TEXT NOT NULL,
  payload JSONB NOT NULL, content_hash CHAR(64) NOT NULL,
  observed_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE candle_revisions (
  id UUID PRIMARY KEY, source TEXT NOT NULL, symbol TEXT NOT NULL, price_type TEXT NOT NULL,
  timeframe TEXT NOT NULL, open_time BIGINT NOT NULL CHECK(open_time BETWEEN 0 AND 9007199254740991),
  open NUMERIC(38,18) NOT NULL, high NUMERIC(38,18) NOT NULL,
  low NUMERIC(38,18) NOT NULL, close NUMERIC(38,18) NOT NULL,
  volume NUMERIC(38,18), turnover NUMERIC(38,18), payload JSONB NOT NULL,
  content_hash CHAR(64) NOT NULL, observed_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT candle_revision_ohlc_check CHECK(low > 0 AND low <= open AND low <= close AND high >= open AND high >= close),
  CONSTRAINT candle_revision_volume_check CHECK((price_type = 'last' AND volume >= 0 AND turnover >= 0 AND volume IS NOT NULL AND turnover IS NOT NULL) OR (price_type IN ('mark','index') AND volume IS NULL AND turnover IS NULL))
);
CREATE UNIQUE INDEX candle_revision_identity_key ON candle_revisions(source,symbol,price_type,timeframe,open_time,content_hash);
CREATE TABLE funding_revisions (
  id UUID PRIMARY KEY, source TEXT NOT NULL, symbol TEXT NOT NULL,
  timestamp BIGINT NOT NULL CHECK(timestamp BETWEEN 0 AND 9007199254740991), rate NUMERIC(38,18) NOT NULL,
  payload JSONB NOT NULL, content_hash CHAR(64) NOT NULL,
  observed_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX funding_revision_identity_key ON funding_revisions(source,symbol,timestamp,content_hash);
CREATE TABLE market_datasets (
  id UUID PRIMARY KEY, snapshot_id UUID NOT NULL,
  request JSONB NOT NULL, status TEXT NOT NULL DEFAULT 'BUILDING' CHECK(status IN ('BUILDING','READY','QUALITY_FAILED')),
  sealed BOOLEAN NOT NULL DEFAULT false, server_cutoff BIGINT, instrument_id UUID,
  quality JSONB, manifest JSONB, fingerprint CHAR(64),
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at TIMESTAMPTZ(3),
  CONSTRAINT market_dataset_snapshot_fkey FOREIGN KEY(snapshot_id) REFERENCES configuration_snapshots(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT market_dataset_instrument_fkey FOREIGN KEY(instrument_id) REFERENCES instrument_observations(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT market_dataset_terminal_check CHECK(status = 'BUILDING' OR (sealed AND manifest IS NOT NULL AND fingerprint IS NOT NULL AND quality IS NOT NULL AND completed_at IS NOT NULL))
);
CREATE INDEX market_dataset_created_id_idx ON market_datasets(created_at,id);
CREATE TABLE dataset_candles (
  dataset_id UUID NOT NULL, stream TEXT NOT NULL, open_time BIGINT NOT NULL, candle_id UUID NOT NULL,
  CONSTRAINT dataset_candle_pkey PRIMARY KEY(dataset_id,stream,open_time),
  CONSTRAINT dataset_candle_dataset_fkey FOREIGN KEY(dataset_id) REFERENCES market_datasets(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT dataset_candle_revision_fkey FOREIGN KEY(candle_id) REFERENCES candle_revisions(id) ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE TABLE dataset_funding (
  dataset_id UUID NOT NULL, timestamp BIGINT NOT NULL, funding_id UUID NOT NULL,
  CONSTRAINT dataset_funding_pkey PRIMARY KEY(dataset_id,timestamp),
  CONSTRAINT dataset_funding_dataset_fkey FOREIGN KEY(dataset_id) REFERENCES market_datasets(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT dataset_funding_revision_fkey FOREIGN KEY(funding_id) REFERENCES funding_revisions(id) ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE TABLE market_data_downloads (
  id UUID PRIMARY KEY, dataset_id UUID NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING', checkpoint JSONB NOT NULL,
  lease_token UUID, lease_expires TIMESTAMPTZ(3), blocked_until TIMESTAMPTZ(3), last_error TEXT,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT market_download_dataset_fkey FOREIGN KEY(dataset_id) REFERENCES market_datasets(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT market_download_status_check CHECK(status IN ('PENDING','RUNNING','PAUSED','FAILED','COMPLETED'))
);
CREATE UNIQUE INDEX market_download_dataset_key ON market_data_downloads(dataset_id);
-- A global lease has one active row; stale owners must be expired transactionally.
CREATE UNIQUE INDEX one_running_market_download ON market_data_downloads((1)) WHERE status = 'RUNNING';

CREATE FUNCTION reject_market_revision_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Market revisions are append-only' USING ERRCODE = '55000'; END;
$$;
CREATE TRIGGER candle_revision_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON candle_revisions FOR EACH STATEMENT EXECUTE FUNCTION reject_market_revision_mutation();
CREATE TRIGGER funding_revision_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON funding_revisions FOR EACH STATEMENT EXECUTE FUNCTION reject_market_revision_mutation();
CREATE TRIGGER instrument_observation_immutable BEFORE UPDATE OR DELETE OR TRUNCATE ON instrument_observations FOR EACH STATEMENT EXECUTE FUNCTION reject_market_revision_mutation();

CREATE FUNCTION protect_market_dataset() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' OR OLD.status <> 'BUILDING' THEN
    RAISE EXCEPTION 'Final market datasets are immutable' USING ERRCODE = '55000';
  END IF;
  IF NEW.id <> OLD.id OR NEW.snapshot_id <> OLD.snapshot_id OR NEW.request <> OLD.request OR
     (OLD.sealed AND (NOT NEW.sealed OR NEW.server_cutoff IS DISTINCT FROM OLD.server_cutoff OR NEW.instrument_id IS DISTINCT FROM OLD.instrument_id)) THEN
    RAISE EXCEPTION 'Dataset descriptor is immutable' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER dataset_guard BEFORE UPDATE OR DELETE ON market_datasets FOR EACH ROW EXECUTE FUNCTION protect_market_dataset();
CREATE TRIGGER dataset_no_truncate BEFORE TRUNCATE ON market_datasets FOR EACH STATEMENT EXECUTE FUNCTION reject_market_revision_mutation();
CREATE FUNCTION protect_market_membership() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent market_datasets%ROWTYPE;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Dataset memberships are append-only' USING ERRCODE = '55000'; END IF;
  SELECT * INTO STRICT parent FROM market_datasets WHERE id = NEW.dataset_id FOR SHARE;
  IF parent.sealed OR parent.status <> 'BUILDING' THEN RAISE EXCEPTION 'Dataset membership is sealed' USING ERRCODE = '55000'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER dataset_candle_guard BEFORE INSERT OR UPDATE OR DELETE ON dataset_candles FOR EACH ROW EXECUTE FUNCTION protect_market_membership();
CREATE TRIGGER dataset_funding_guard BEFORE INSERT OR UPDATE OR DELETE ON dataset_funding FOR EACH ROW EXECUTE FUNCTION protect_market_membership();
CREATE TRIGGER dataset_candle_no_truncate BEFORE TRUNCATE ON dataset_candles FOR EACH STATEMENT EXECUTE FUNCTION reject_market_revision_mutation();
CREATE TRIGGER dataset_funding_no_truncate BEFORE TRUNCATE ON dataset_funding FOR EACH STATEMENT EXECUTE FUNCTION reject_market_revision_mutation();
INSERT INTO app_metadata(key,value) VALUES ('market_data_schema_version','1');
