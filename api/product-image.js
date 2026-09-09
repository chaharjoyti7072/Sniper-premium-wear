const { get } = require("@vercel/blob");
const { Readable } = require("stream");

module.exports = async (req, res) => {
  try {
    if (req.method !== "GET") {
      return res.status(405).send("Method not allowed");
    }

    const key = String(req.query.key || "");

    if (!key) {
      return res.status(400).send("Missing image key");
    }

    if (!key.startsWith("products/")) {
      return res.status(403).send("Invalid image");
    }

    const result = await get(key, {
      access: "private",
      useCache: true
    });

    if (!result) {
      return res.status(404).send("Image not found");
    }

    res.setHeader(
      "Content-Type",
      result.blob.contentType || "image/jpeg"
    );

    res.setHeader(
      "Cache-Control",
      "public, max-age=31536000, immutable"
    );

    Readable.fromWeb(result.stream).pipe(res);

  } catch (error) {
    console.error("Product image error:", error);

    return res.status(500).send(
      error.message || "Image error"
    );
  }
};
