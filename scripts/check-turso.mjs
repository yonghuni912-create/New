import { createClient } from "@libsql/client";
const client = createClient({
  url: "libsql://bbqtest-kunikun.aws-us-west-2.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NjgyNTQ5NDIsImlkIjoiYjg0NDM1NGUtZjE4YS00NWMzLWI1ZDctNDk2NjljOTM3ZDY3IiwicmlkIjoiZWYzYzk2MGItMDk4Mi00ODhiLWJiNjEtMzc2YzJhNzgwYTliIn0.KSdizD28gjbcZiAjX7KOywhPusSQcPcLDd89ovltYNQX9y2tKakH83Dwxv-iR9JnP5mqOWFGZIT5afP3n6obBA"
});

// Check data counts
console.log("=== Production Turso DB Data Status ===\n");

try {
  const ingredients = await client.execute("SELECT COUNT(*) as count FROM IngredientMaster");
  console.log("IngredientMaster:", ingredients.rows[0].count);
} catch (e) {
  console.log("IngredientMaster: Table not found or error");
}

try {
  const priceItems = await client.execute("SELECT COUNT(*) as count FROM PriceTemplateItem");
  console.log("PriceTemplateItem:", priceItems.rows[0].count);
} catch (e) {
  console.log("PriceTemplateItem: Table not found or error");
}

try {
  const manuals = await client.execute("SELECT COUNT(*) as count FROM MenuManual");
  console.log("MenuManual:", manuals.rows[0].count);
} catch (e) {
  console.log("MenuManual: Table not found or error");
}

try {
  const users = await client.execute("SELECT COUNT(*) as count FROM User");
  console.log("User:", users.rows[0].count);
} catch (e) {
  console.log("User: Table not found or error");
}

try {
  const templates = await client.execute("SELECT COUNT(*) as count FROM PriceTemplate");
  console.log("PriceTemplate:", templates.rows[0].count);
} catch (e) {
  console.log("PriceTemplate: Table not found or error");
}

try {
  const manualIngredients = await client.execute("SELECT COUNT(*) as count FROM ManualIngredient");
  console.log("ManualIngredient:", manualIngredients.rows[0].count);
} catch (e) {
  console.log("ManualIngredient: Table not found or error");
}

await client.close();
