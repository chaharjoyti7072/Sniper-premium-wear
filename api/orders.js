const { getJSON, putJSON } = require("../_store");

module.exports = async (req, res) => {
  try {
    // Allow only GET, PATCH and DELETE
    if (
      req.method !== "GET" &&
      req.method !== "PATCH" &&
      req.method !== "DELETE"
    ) {
      return res.status(405).json({
        error: "Method not allowed"
      });
    }

    // Admin authentication
    const authHeader = req.headers.authorization || "";

    if (
      !process.env.ADMIN_PASSWORD ||
      authHeader !== `Bearer ${process.env.ADMIN_PASSWORD}`
    ) {
      return res.status(401).json({
        error: "Unauthorized"
      });
    }

    const orders = await getJSON("orders", []);

    // =========================
    // GET ORDERS
    // =========================
    if (req.method === "GET") {
      const sortedOrders = [...orders].sort(
        (a, b) =>
          new Date(b.createdAt || 0) -
          new Date(a.createdAt || 0)
      );

      return res.status(200).json({
        ok: true,
        orders: sortedOrders
      });
    }

    // =========================
    // UPDATE ORDER STATUS
    // =========================
    if (req.method === "PATCH") {
      const body = req.body || {};

      const id = String(body.id || "").trim();
      const status = String(body.status || "").trim();

      if (!id) {
        return res.status(400).json({
          error: "Order ID is required"
        });
      }

      if (!status) {
        return res.status(400).json({
          error: "Order status is required"
        });
      }

      const exists = orders.some(
        order => String(order.id || "") === id
      );

      if (!exists) {
        return res.status(404).json({
          error: "Order not found"
        });
      }

      const updatedOrders = orders.map(order => {
        if (String(order.id || "") !== id) {
          return order;
        }

        return {
          ...order,
          status: status,
          updatedAt: new Date().toISOString()
        };
      });

      await putJSON(
        "orders",
        updatedOrders
      );

      return res.status(200).json({
        ok: true,
        orders: updatedOrders
      });
    }

    // =========================
    // DELETE ORDER
    // =========================
    if (req.method === "DELETE") {
      const body = req.body || {};

      const id = String(
        body.id ||
        req.query.id ||
        ""
      ).trim();

      if (!id) {
        return res.status(400).json({
          error: "Order ID is required"
        });
      }

      const exists = orders.some(
        order => String(order.id || "") === id
      );

      if (!exists) {
        return res.status(404).json({
          error: "Order not found"
        });
      }

      const remainingOrders = orders.filter(
        order => String(order.id || "") !== id
      );

      await putJSON(
        "orders",
        remainingOrders
      );

      return res.status(200).json({
        ok: true,
        message: "Order deleted successfully",
        orderId: id,
        orders: remainingOrders
      });
    }

  } catch (error) {
    console.error(
      "Orders API error:",
      error
    );

    return res.status(500).json({
      error:
        error.message ||
        "Server error"
    });
  }
};
