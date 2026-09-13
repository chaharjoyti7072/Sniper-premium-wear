const { getJSON } = require("../_store");

module.exports = async (req, res) => {
  try {
    const products = await getJSON("products", []);

    const list = Array.isArray(products)
      ? products
      : Array.isArray(products.products)
        ? products.products
        : [];

    const baseUrl = "https://www.sniperpremiumwear.com";

    const urls = [
      {
        loc: `${baseUrl}/`,
        priority: "1.0"
      }
    ];

    list.forEach((product) => {
      if (
        product &&
        product.id !== undefined &&
        product.id !== null
      ) {
        urls.push({
          loc: `${baseUrl}/product/${encodeURIComponent(
            String(product.id)
          )}`,
          priority: "0.8"
        });
      }
    });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (item) => `  <url>
    <loc>${escapeXml(item.loc)}</loc>
    <changefreq>daily</changefreq>
    <priority>${item.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>`;

    res.setHeader(
      "Content-Type",
      "application/xml; charset=utf-8"
    );

    res.setHeader(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=600"
    );

    return res.status(200).send(xml);

  } catch (error) {
    console.error("Sitemap error:", error);

    return res.status(500).send(
      `<?xml version="1.0" encoding="UTF-8"?>
<error>Sitemap generation failed</error>`
    );
  }
};

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
