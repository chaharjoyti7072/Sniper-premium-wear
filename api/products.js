const { getJSON, putJSON } = require("../_store");

function auth(req) {
  return (
    !!process.env.ADMIN_PASSWORD &&
    req.headers.authorization ===
      `Bearer ${process.env.ADMIN_PASSWORD}`
  );
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function absoluteImageUrl(url, baseUrl) {
  const value = String(url || "").trim();

  if (!value) return "";

  if (
    value.startsWith("http://") ||
    value.startsWith("https://")
  ) {
    return value;
  }

  return `${baseUrl}${value.startsWith("/") ? "" : "/"}${value}`;
}

function getProductImages(product, baseUrl) {
  let images = [];

  if (Array.isArray(product.images)) {
    images = product.images;
  }

  if (
    !images.length &&
    Array.isArray(product.photos)
  ) {
    images = product.photos;
  }

  if (
    !images.length &&
    product.img
  ) {
    images = [product.img];
  }

  return [
    ...new Set(
      images
        .filter(Boolean)
        .map((image) =>
          absoluteImageUrl(image, baseUrl)
        )
        .filter(Boolean)
    )
  ].slice(0, 5);
}

module.exports = async (req, res) => {
  try {

    /*
    =====================================================
    GET PRODUCTS
    =====================================================
    */

    if (req.method === "GET") {

      /*
      -----------------------------------------------------
      SEO SITEMAP
      /sitemap.xml -> /api/products?sitemap=1
      -----------------------------------------------------
      */

      if (
        String(req.query?.sitemap || "") === "1"
      ) {

        const products =
          await getJSON("products", []);

        const list = Array.isArray(products)
          ? products
          : Array.isArray(products.products)
            ? products.products
            : [];

        const baseUrl =
          "https://www.sniperpremiumwear.com";

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
              loc:
                `${baseUrl}/product/` +
                encodeURIComponent(
                  String(product.id)
                ),
              priority: "0.8"
            });

          }

        });

        const xml =
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((item) => `
  <url>
    <loc>${escapeXml(item.loc)}</loc>
    <changefreq>daily</changefreq>
    <priority>${item.priority}</priority>
  </url>`).join("")}
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
      }


      /*
      -----------------------------------------------------
      SEO PRODUCT PAGE
      /product/123 -> /api/products?id=123
      -----------------------------------------------------
      */

      if (
        req.query?.id !== undefined &&
        req.query?.id !== ""
      ) {

        const id =
          String(req.query.id).trim();

        const products =
          await getJSON("products", []);

        const list = Array.isArray(products)
          ? products
          : Array.isArray(products.products)
            ? products.products
            : [];

        const product =
          list.find(
            (item) =>
              String(item.id) === id
          );

        if (!product) {
          return res.status(404).send(
            "<h1>Product not found</h1>"
          );
        }

        const baseUrl =
          "https://www.sniperpremiumwear.com";

        const productUrl =
          `${baseUrl}/product/${encodeURIComponent(id)}`;

        const name =
          String(product.name || "Product").trim();

        const description =
          String(
            product.description ||
            `${name} from Sniper Premium Wear. Premium army-inspired and utility wear.`
          ).trim();

        const price =
          Number(product.price || 0);

        const images =
          getProductImages(
            product,
            baseUrl
          );

        const sizes =
          Array.isArray(product.sizes)
            ? product.sizes.join(", ")
            : String(product.sizes || "");

        const productSchema = {
          "@context": "https://schema.org",
          "@type": "Product",
          name,
          description,
          url: productUrl,
          image: images,
          category:
            String(product.category || ""),
          brand: {
            "@type": "Brand",
            name: "Sniper Premium Wear"
          },
          offers: {
            "@type": "Offer",
            url: productUrl,
            priceCurrency: "INR",
            price: price.toFixed(2),
            availability:
              "https://schema.org/InStock"
          }
        };

        const imageHtml =
          images.length
            ? images.map((image) =>
                `<img src="${escapeHtml(image)}" alt="${escapeHtml(name)}">`
              ).join("")
            : `
              <div class="no-image">
                Product image unavailable
              </div>
            `;

        const html =
`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport"
      content="width=device-width, initial-scale=1.0">

<title>${escapeHtml(name)} | Sniper Premium Wear</title>

<meta name="description"
      content="${escapeHtml(description.slice(0, 160))}">

<link rel="canonical"
      href="${escapeHtml(productUrl)}">

<meta property="og:type"
      content="product">

<meta property="og:title"
      content="${escapeHtml(name)} | Sniper Premium Wear">

<meta property="og:description"
      content="${escapeHtml(description.slice(0, 160))}">

<meta property="og:url"
      content="${escapeHtml(productUrl)}">

${
  images[0]
    ? `<meta property="og:image" content="${escapeHtml(images[0])}">`
    : ""
}

<script type="application/ld+json">
${JSON.stringify(productSchema).replace(/</g, "\\u003c")}
</script>

<style>
*{
  box-sizing:border-box;
}

body{
  margin:0;
  font-family:Arial,sans-serif;
  background:#f5f5f5;
  color:#111;
}

.container{
  max-width:1100px;
  margin:0 auto;
  padding:20px;
}

.card{
  background:#fff;
  border-radius:16px;
  padding:20px;
  box-shadow:0 3px 15px rgba(0,0,0,.08);
}

.gallery{
  display:grid;
  grid-template-columns:
    repeat(auto-fit,minmax(220px,1fr));
  gap:15px;
}

.gallery img{
  width:100%;
  height:360px;
  object-fit:contain;
  background:#fafafa;
  border-radius:12px;
}

h1{
  margin:25px 0 10px;
  font-size:30px;
}

.price{
  font-size:27px;
  font-weight:bold;
  margin:15px 0;
}

.info{
  line-height:1.7;
}

.back{
  display:inline-block;
  margin-bottom:15px;
  text-decoration:none;
  color:#111;
  font-weight:bold;
}

button{
  background:#111;
  color:#fff;
  border:0;
  padding:13px 22px;
  border-radius:8px;
  font-size:16px;
}

.no-image{
  padding:60px 20px;
  text-align:center;
  background:#eee;
  border-radius:12px;
}

@media(max-width:600px){

  .container{
    padding:12px;
  }

  .gallery img{
    height:280px;
  }

  h1{
    font-size:24px;
  }

}
</style>
</head>

<body>

<div class="container">

  <div class="card">

    <a class="back" href="/">
      ← Back to Shop
    </a>

    <div class="gallery">
      ${imageHtml}
    </div>

    <h1>${escapeHtml(name)}</h1>

    <div class="price">
      ₹${price.toLocaleString("en-IN")}
    </div>

    <div class="info">

      ${
        product.category
          ? `<p><strong>Category:</strong>
             ${escapeHtml(product.category)}</p>`
          : ""
      }

      ${
        product.fabric
          ? `<p><strong>Fabric:</strong>
             ${escapeHtml(product.fabric)}</p>`
          : ""
      }

      ${
        sizes
          ? `<p><strong>Available Sizes:</strong>
             ${escapeHtml(sizes)}</p>`
          : ""
      }

      <p>
        ${escapeHtml(description)}
      </p>

    </div>

    <p>
      <a href="/">
        <button>Shop Now</button>
      </a>
    </p>

  </div>

</div>

</body>
</html>`;

        res.setHeader(
          "Content-Type",
          "text/html; charset=utf-8"
        );

        res.setHeader(
          "Cache-Control",
          "public, s-maxage=300, stale-while-revalidate=600"
        );

        return res.status(200).send(html);
      }


      /*
      -----------------------------------------------------
      NORMAL PRODUCTS API
      -----------------------------------------------------
      */

      return res.status(200).json({
        products:
          await getJSON("products", [])
      });

    }


    /*
    =====================================================
    ADMIN AUTH
    =====================================================
    */

    if (!auth(req)) {

      return res.status(401).json({
        error: "Unauthorized"
      });

    }


    /*
    =====================================================
    ADD / EDIT PRODUCT
    =====================================================
    */

    if (
      req.method === "POST" ||
      req.method === "PUT"
    ) {

      const body =
        req.body || {};


      if (!body.name) {

        return res.status(400).json({
          error:
            "Product name is required"
        });

      }


      if (
        !Number.isFinite(
          Number(body.price)
        ) ||
        Number(body.price) <= 0
      ) {

        return res.status(400).json({
          error:
            "Valid price is required"
        });

      }


      const list =
        await getJSON(
          "products",
          []
        );


      /*
      =========================
      IMAGES
      =========================
      */

      let images = [];


      if (
        Array.isArray(body.images)
      ) {

        images =
          body.images
            .filter(Boolean)
            .map(function(image) {
              return String(image).trim();
            })
            .filter(Boolean);

      }


      if (
        Array.isArray(body.photos)
      ) {

        images = [
          ...images,
          ...body.photos
            .filter(Boolean)
            .map(function(image) {
              return String(image).trim();
            })
            .filter(Boolean)
        ];

      }


      const oldImg =
        String(
          body.img || ""
        ).trim();


      if (
        oldImg &&
        !images.includes(oldImg)
      ) {

        images.unshift(oldImg);

      }


      images = [
        ...new Set(images)
      ].slice(0, 5);


      const mainImage =
        images.length
          ? images[0]
          : "";


      /*
      =========================
      PRODUCT OBJECT
      =========================
      */

      const product = {

        id:
          Number(body.id) ||
          Date.now(),

        name:
          String(
            body.name
          ).trim(),

        category:
          String(
            body.category || ""
          ).trim(),

        featured:
          body.featured === true ||
          body.featured === "true",

        price:
          Math.round(
            Number(body.price)
          ),

        sizes:
          String(
            body.sizes || ""
          ).trim(),

        fabric:
          String(
            body.fabric || ""
          ).trim(),

        img:
          mainImage,

        images:
          images,

        description:
          String(
            body.description ||
            "Premium quality"
          ).trim()

      };


      /*
      =========================
      UPDATE / ADD
      =========================
      */

      let updatedList;


      if (
        req.method === "PUT"
      ) {

        updatedList =
          list.map(function(item) {

            if (
              item.id === product.id &&
              images.length === 0
            ) {

              return {
                ...item,

                ...product,

                img:
                  item.img || "",

                images:
                  Array.isArray(item.images)
                    ? item.images
                    : (
                        item.img
                          ? [item.img]
                          : []
                      )
              };

            }


            return (
              item.id === product.id
                ? product
                : item
            );

          });

      } else {

        updatedList = [
          ...list,
          product
        ];

      }


      /*
      =========================
      SAVE
      =========================
      */

      await putJSON(
        "products",
        updatedList
      );


      return res.status(200).json({
        products:
          updatedList
      });

    }


    /*
    =====================================================
    DELETE PRODUCT
    =====================================================
    */

    if (
      req.method === "DELETE"
    ) {

      const id =
        Number(
          req.query.id
        );


      const list =
        await getJSON(
          "products",
          []
        );


      const updatedList =
        list.filter(function(item) {

          return item.id !== id;

        });


      await putJSON(
        "products",
        updatedList
      );


      return res.status(200).json({
        products:
          updatedList
      });

    }


    /*
    =====================================================
    METHOD NOT ALLOWED
    =====================================================
    */

    return res.status(405).json({
      error:
        "Method not allowed"
    });


  } catch (error) {

    console.error(
      "Products API error:",
      error
    );

    return res.status(500).json({
      error:
        error.message ||
        "Server error"
    });

  }
};
