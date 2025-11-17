-- Grant execute permission on the RPC function to authenticated users
GRANT EXECUTE ON FUNCTION get_economic_group_impact(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_economic_group_impact(INT) TO anon;
