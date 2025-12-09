const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error("Missing env vars");
  process.exit(1);
}

async function check() {
  // URL encode the search term: %vale%alimenta%
  // ilike operator needs the pattern to be part of the value
  const searchTerm = "%vale%alimenta%";
  const endpoint = `${url}/rest/v1/expenses?select=description,due_date,is_recurring,recurrence_end_date&description=ilike.${searchTerm}&order=due_date.desc&limit=5`;
  
  try {
    const response = await fetch(endpoint, {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP error! status: ${response.status}, body: ${text}`);
    }
    
    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(e);
  }
}

check();
