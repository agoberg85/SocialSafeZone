sql
-- Profiles
profiles (
  id uuid PRIMARY KEY,
  email text,
  subscription_status enum(FREE, PRO, STUDIO),
  stripe_customer_id text,
  stripe_subscription_id text
)

-- Campaigns
campaigns (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES profiles,
  name text,
  client_name text,
  description text,
  deadline date,
  total_budget numeric
)

-- Campaign Formats
campaign_formats (
  id uuid PRIMARY KEY,
  campaign_id uuid REFERENCES campaigns,
  format_name text,
  platform text,
  custom_width int,
  custom_height int,
  placement text,
  budget numeric,
  start_date date,
  end_date date,
  impressions numeric,
  reach numeric,
  cpm numeric,
  frequency numeric,
  notes text
)

-- Platform Formats
platform_formats (
  id uuid PRIMARY KEY,
  platform text,
  format_name text,
  width int,
  height int,
  description text,
  safe_zone jsonb,      -- {top, right, bottom, left}
  danger_zones jsonb,   -- Array of rectangles
  reference_link text,
  sort_order int
)