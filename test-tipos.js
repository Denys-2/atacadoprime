import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://lvhddybzpjrnwfltkiwo.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2aGRkeWJ6cGpybndmbHRraXdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NTgxOTYsImV4cCI6MjA5NzMzNDE5Nn0.sk2txLJSs2F6lWUm7-kbtaL4PTwSu__6WUtQsPGWlv8";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkTipos() {
  const { data } = await supabase.from("products").select("id, nome, tipo, status");
  const tipos = new Set(data?.map(p => p.tipo));
  console.log("Tipos de produtos no banco:", Array.from(tipos));
  console.log("Contagem por tipo:");
  const counts = {};
  data?.forEach(p => {
    counts[p.tipo] = (counts[p.tipo] || 0) + 1;
  });
  console.log(counts);
}

checkTipos();
