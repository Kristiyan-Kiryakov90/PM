-- Function to create a company and assign the calling admin to it
-- Bypasses RLS via SECURITY DEFINER since the admin can't SELECT the new row
-- until their profile is updated (chicken-and-egg problem with user_company_id())
CREATE OR REPLACE FUNCTION create_company_for_admin(company_name text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_company_id bigint;
  caller_role text;
  caller_company_id bigint;
BEGIN
  -- Verify the caller is an admin or sys_admin
  SELECT role, company_id INTO caller_role, caller_company_id
  FROM profiles
  WHERE id = auth.uid();

  IF caller_role IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF caller_role NOT IN ('admin', 'sys_admin') THEN
    RAISE EXCEPTION 'Only admins can create companies';
  END IF;

  IF caller_company_id IS NOT NULL AND caller_role = 'admin' THEN
    RAISE EXCEPTION 'Admin already belongs to a company';
  END IF;

  -- Create the company
  INSERT INTO companies (name)
  VALUES (company_name)
  RETURNING id INTO new_company_id;

  -- Assign the admin to the new company (skip for sys_admin)
  IF caller_role = 'admin' THEN
    UPDATE profiles
    SET company_id = new_company_id
    WHERE id = auth.uid();
  END IF;

  RETURN new_company_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION create_company_for_admin(text) TO authenticated;
