const { createShiprocketOrder } = require("./shiprocket");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });
  }

  try {
    const order = req.body;

    if (!order || !order.order_id) {
      return res.status(400).json({
        success: false,
        message: "Order details are missing"
      });
    }

    if (!order.name || !order.mobile || !order.address || !order.pin) {
      return res.status(400).json({
        success: false,
        message: "Customer delivery details are missing"
      });
    }

    if (!Array.isArray(order.items) || order.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Order items are missing"
      });
    }

    const result = await createShiprocketOrder(order);

    return res.status(200).json({
      success: true,
      message: "Order created in Shiprocket",
      shiprocket: result
    });

  } catch (error) {
    console.error("Shiprocket error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Shiprocket order failed"
    });
  }
};
