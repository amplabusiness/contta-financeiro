-- Create function to automatically assign admin role to first user
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert admin role for the new user
  INSERT INTO public.user_roles (user_id, role, created_by)
  VALUES (NEW.id, 'admin', NEW.id);
  
  RETURN NEW;
END;
$$;

-- Create trigger to assign role on user creation
DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_role();

-- Assign admin role to existing users who don't have roles
INSERT INTO public.user_roles (user_id, role, created_by)
SELECT 
  id,
  'admin'::app_role,
  id
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_roles)
ON CONFLICT (user_id, role) DO NOTHING;