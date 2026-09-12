module.exports = async (req, res) => {
  try {
    const id = String(req.query?.id || "").trim();

    if (!id) {
      return res.status(400).send("Product ID is required");
    }

    const protocol =
      req.headers["x-forwarded-proto"] ||
      (req.connection && req.connection.encrypted ? "https" : "http");

    const host = req.headers.host;
    const baseUrl = `${protocol}://${host}`;

    const response = await fetch(`${baseUrl}/api/products`);

    if (!response.ok) {
      return res.status(500).send("Unable to load products");
    }

    const data = await response.json();

    const products = Array.isArray(data)
      ? data
      : Array.isArray(data.products)
        ? data.products
        : [];

    const product = products.find(
      (p) => String(p.id) === id
    );

    if (!product) {
      return res.status(404).send("Product not found");
    }

    const name = String(product.name || "Product");
    const description = String(
      product.description ||
      `${name} from Sniper Premium Wear. Premium army-inspired and utility wear.`
    );

    const price = Number(product.price || 0);

    const photos = Array.isArray(product.photos)
      ? product.photos.filter(Boolean)
      : product.image
        ? [product.image]
        : [];

    const images = photos.map((url) => {
      if (String(url).startsWith("http")) return url;
      return `${baseUrl}${String(url).startsWith("/") ? "" : "/"}${url}`;
    });

    const productUrl = `${baseUrl}/product/${encodeURIComponent(id)}`;

    const sizes = Array.isArray(product.sizes)
      ? product.sizes.join(", ")
      : String(product.sizes || "");

    const productSchema = {
      "@context": "https://schema.org",
      "@type": "Product",
      name,
      description,
      url: productUrl,
      image: images,
      category: String(product.category || ""),
      brand: {
        "@type": "Brand",
        name: "Sniper Premium Wear"
      },
      offers: {
        "@type": "Offer",
        url: productUrl,
        priceCurrency: "INR",
        price: price.toFixed(2),
        availability: "https://schema.org/InStock"
      }
    };

    const esc = (value) =>
      String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const imageHtml = images.length
      ? images
          .map(
            (img) =>
              `<img src="${esc(img)}" alt="${esc(name)}" loading="lazy">`
          )
          .join("")
      : "";

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>${esc(name)} | Sniper Premium Wear</title>

<meta name="description" content="${esc(
      description.slice(0, 160)
    )}">

<link rel="canonical" href="${esc(productUrl)}">

<meta property="og:type" content="product">
<meta property="og:title" content="${esc(name)} | Sniper Premium Wear">
<meta property="og:description" content="${esc(
      description.slice(0, 160)
    )}">
<meta property="og:url" content="${esc(productUrl)}">
${
  images[0]
    ? `<meta property="og:image" content="${esc(images[0])}">`
    : ""
}

<script type="application/ld+json">
${JSON.stringify(productSchema).replace(/</g, "\\u003c")}
</script>

<style>
body{
  margin:0;
  font-family:Arial,sans-serif;
  background:#f5f5f5;
  color:#111;
}
.container{
  max-width:1100px;
  margin:auto;
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
  grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
  gap:15px;
}
.gallery img{
  width:100%;
  height:350px;
  object-fit:contain;
  background:#fafafa;
  border-radius:12px;
}
h1{
  margin-top:25px;
  font-size:30px;
}
.price{
  font-size:26px;
  font-weight:bold;
  margin:15px 0;
}
.info{
  line-height:1.7;
}
button{
  background:#111;
  color:#fff;
  border:0;
  padding:13px 22px;
  border-radius:8px;
  font-size:16px;
}
a{
  color:inherit;
  text-decoration:none;
}
@media(max-width:600px){
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

    <div class="gallery">
      ${imageHtml}
    </div>

    <h1>${esc(name)}</h1>

    <div class="price">₹${price.toLocaleString("en-IN")}</div>

    <div class="info">
      ${
        product.category
          ? `<p><strong>Category:</strong> ${esc(product.category)}</p>`
          : ""
      }

      ${
        product.fabric
          ? `<p><strong>Fabric:</strong> ${esc(product.fabric)}</p>`
          : ""
      }

      ${
        sizes
          ? `<p><strong>Available Sizes:</strong> ${esc(sizes)}</p>`
          : ""
      }

      <p>${esc(description)}</p>
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
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=600"
    );

    return res.status(200).send(html);

  } catch (error) {
    console.error(error);
    return res.status(500).send("Server error");
  }
};
