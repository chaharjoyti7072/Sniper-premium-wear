const { getJSON, putJSON } = require("../_store");

module.exports = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (
      !process.env.ADMIN_PASSWORD ||
      authHeader !== `Bearer ${process.env.ADMIN_PASSWORD}`
    ) {
      return res.status(401).json({
        error: "Unauthorized"
      });
    }

    const orders = await getJSON("orders", []);

    if (req.method === "GET") {
      const sortedOrders = [...orders].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );

      return res.status(200).json({
        orders: sortedOrders
      });
    }

    if (req.method === "PATCH") {
      const body = req.body || {};

      const updatedOrders = orders.map((order) =>
        order.id === body.id
          ? {
              ...order,
              status: String(body.status || order.status),
              updatedAt: new Date().toISOString()
            }
          : order
      );

      await putJSON("orders", updatedOrders);

      return res.status(200).json({
        orders: updatedOrders
      });
    }

    return res.status(405).json({
      error: "Method not allowed"
    });
  } catch (error) {
    console.error("Orders API error:", error);

    return res.status(500).json({
      error: error.message || "Server error"
    });
  }
};
