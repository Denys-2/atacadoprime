import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://lvhddybzpjrnwfltkiwo.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2aGRkeWJ6cGpybndmbHRraXdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NTgxOTYsImV4cCI6MjA5NzMzNDE5Nn0.sk2txLJSs2F6lWUm7-kbtaL4PTwSu__6WUtQsPGWlv8";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkQuery() {
  console.log("--- TESTANDO QUERY EXATA DO V3.INDEX ---");
  const { data, error } = await supabase
    .from("products")
    .select("*, brands(nome), categories(nome), product_images(image_url, tipo_imagem, ordem)")
    .eq("status", true)
    .order("nome");

  if (error) {
    console.error("ERRO NA QUERY:", error);
  } else {
    console.log("Sucesso! Produtos retornados:", data?.length);
    if (data && data.length > 0) console.log("Primeiro produto:", data[0]);
  }
}

checkQuery();
