-- Migration: Add auth trigger for automatic tenant creation
-- This trigger was lost during database dump/restore
-- Only affects NEW users - existing users are not impacted

-- Remove trigger if exists (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger that fires after new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Note: COMMENT on auth.users trigger requires superuser privileges, skipping
