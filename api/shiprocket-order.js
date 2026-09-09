const { createShiprocketOrder } = require("./shiprocket");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const order = req.body;

    if (!order || !order.order_id) {
      return res.status(400).json({
        error: "Order details are missing"
      });
    }

    const result = await createShiprocketOrder(order);

    return res.status(200).json({
      success: true,
      message: "Order sent to Shiprocket successfully",
      shiprocket: result
    });
  } catch (error) {
    console.error("Shiprocket error:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Shiprocket order failed"
    });
  }
};
