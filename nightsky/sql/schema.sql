create table if not exists landing (
  id bigserial primary key,
  source text not null,
  fetched_at timestamptz not null default now(),
  checksum text,
  body jsonb,
  status text not null default 'ok',
  error text
);

create table if not exists stars (
  catalog_id text primary key,
  name text,
  ra_deg double precision not null,
  dec_deg double precision not null,
  mag double precision,
  pm_ra double precision,
  pm_dec double precision,
  parallax double precision,
  spectral_type text
);
create index if not exists stars_mag_idx on stars (mag);
create index if not exists stars_radec_idx on stars (ra_deg, dec_deg);

create table if not exists deep_sky_objects (
  catalog_id text primary key,
  name text,
  ra_deg double precision not null,
  dec_deg double precision not null,
  object_type text,
  mag double precision,
  major_arcmin double precision
);
create index if not exists dso_radec_idx on deep_sky_objects (ra_deg, dec_deg);

create table if not exists satellites (
  norad_id integer primary key,
  name text,
  intl_desig text,
  epoch timestamptz not null,
  elements jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists captures (
  id bigserial primary key,
  taken_at timestamptz,
  latitude double precision,
  longitude double precision,
  elevation_m double precision,
  exposure_seconds double precision,
  image_key text not null,
  solve_status text not null default 'pending'
);

create table if not exists plate_solutions (
  capture_id bigint primary key references captures (id),
  center_ra_deg double precision not null,
  center_dec_deg double precision not null,
  pixel_scale_arcsec double precision not null,
  rotation_deg double precision not null,
  wcs jsonb not null
);

create table if not exists identifications (
  id bigserial primary key,
  capture_id bigint not null references captures (id),
  object_type text not null,
  catalog_id text not null,
  pixel_x double precision,
  pixel_y double precision,
  separation_arcsec double precision,
  confidence double precision
);
