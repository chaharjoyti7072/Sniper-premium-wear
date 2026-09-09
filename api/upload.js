const { put } = require("@vercel/blob");

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        error: "Method not allowed"
      });
    }

    const auth = req.headers.authorization;

    if (
      !process.env.ADMIN_PASSWORD ||
      auth !== `Bearer ${process.env.ADMIN_PASSWORD}`
    ) {
      return res.status(401).json({
        error: "Unauthorized"
      });
    }

    const body = req.body || {};

    if (!body.data) {
      return res.status(400).json({
        error: "Image file is missing"
      });
    }

    const contentType =
      body.contentType || "image/jpeg";

    if (!contentType.startsWith("image/")) {
      return res.status(400).json({
        error: "Only image files are allowed"
      });
    }

    const base64 = String(body.data)
      .replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");

    const buffer = Buffer.from(base64, "base64");

    if (!buffer.length) {
      return res.status(400).json({
        error: "Image data is empty"
      });
    }

    const extension =
      contentType.split("/")[1] || "jpg";

    const pathname =
      `products/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${extension}`;

    const blob = await put(
      pathname,
      buffer,
      {
        access: "private",
        addRandomSuffix: false,
        contentType
      }
    );

    return res.status(200).json({
      success: true,
      pathname: blob.pathname
    });

  } catch (error) {
    console.error("Upload error:", error);

    return res.status(500).json({
      error: error.message || "Upload failed"
    });
  }
};
