import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://lvhddybzpjrnwfltkiwo.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2aGRkeWJ6cGpybndmbHRraXdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NTgxOTYsImV4cCI6MjA5NzMzNDE5Nn0.sk2txLJSs2F6lWUm7-kbtaL4PTwSu__6WUtQsPGWlv8";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
  console.log("--- TESTANDO BANCO SUPABASE ---");
  const { data: cats, error: catErr } = await supabase.from("categories").select("id, nome");
  console.log("Categorias encontradas:", catErr ? catErr.message : cats?.length);
  if (cats && cats.length > 0) console.log("Exemplo Categorias:", cats.slice(0, 5));

  const { data: prods, error: prodErr } = await supabase.from("products").select("id, nome, status, tipo, preco_unitario");
  console.log("Produtos encontrados:", prodErr ? prodErr.message : prods?.length);
  if (prods && prods.length > 0) console.log("Exemplo Produtos:", prods.slice(0, 5));

  const { data: brands, error: brandErr } = await supabase.from("brands").select("id, nome");
  console.log("Marcas encontradas:", brandErr ? brandErr.message : brands?.length);
  if (brands && brands.length > 0) console.log("Exemplo Marcas:", brands.slice(0, 5));
}

check();
