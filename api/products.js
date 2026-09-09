const { getJSON, putJSON } = require("../_store");

function auth(req) {
  return (
    !!process.env.ADMIN_PASSWORD &&
    req.headers.authorization === `Bearer ${process.env.ADMIN_PASSWORD}`
  );
}

module.exports = async (req, res) => {
  try {
    // Products read
    if (req.method === "GET") {
      return res.status(200).json({
        products: await getJSON("products", [])
      });
    }

    // Admin authentication
    if (!auth(req)) {
      return res.status(401).json({
        error: "Unauthorized"
      });
    }

    // Add / Update product
    if (req.method === "POST" || req.method === "PUT") {
      const body = req.body || {};

      if (
        !body.name ||
        !Number.isFinite(Number(body.price))
      ) {
        return res.status(400).json({
          error: "Name and valid price are required"
        });
      }

      const list = await getJSON("products", []);

      const product = {
        id: Number(body.id) || Date.now(),
        name: String(body.name).trim(),
        price: Math.round(Number(body.price)),
        img: String(body.img || "").trim(),
        description: String(
          body.description || "Premium quality"
        ).trim()
      };

      const updatedList =
        req.method === "PUT"
          ? list.map((item) =>
              item.id === product.id ? product : item
            )
          : [...list, product];

      await putJSON("products", updatedList);

      return res.status(200).json({
        products: updatedList
      });
    }

    // Delete product
    if (req.method === "DELETE") {
      const id = Number(req.query.id);

      const list = await getJSON("products", []);
      const updatedList = list.filter(
        (item) => item.id !== id
      );

      await putJSON("products", updatedList);

      return res.status(200).json({
        products: updatedList
      });
    }

    return res.status(405).json({
      error: "Method not allowed"
    });
  } catch (error) {
    console.error("Products API error:", error);

    return res.status(500).json({
      error: error.message || "Server error"
    });
  }
};
