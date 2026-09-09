const { getJSON, putJSON } = require("../_store");

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        error: "Method not allowed"
      });
    }

    const auth = req.headers.authorization;

    if (
      !process.env.ADMIN_PASSWORD ||
      auth !== `Bearer ${process.env.ADMIN_PASSWORD}`
    ) {
      return res.status(401).json({
        success: false,
        error: "Unauthorized"
      });
    }

    const { orderId } = req.body || {};

    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: "Order ID is missing"
      });
    }

    const orders = await getJSON("orders", []);

    const localOrder = orders.find(
      order =>
        String(order.id) === String(orderId) ||
        String(order.razorpayOrderId) === String(orderId)
    );

    if (!localOrder) {
      return res.status(404).json({
        success: false,
        error: "Order not found"
      });
    }

    const key = process.env.RAZORPAY_KEY_ID;
    const secret = process.env.RAZORPAY_KEY_SECRET;

    if (!key || !secret) {
      return res.status(500).json({
        success: false,
        error: "Razorpay keys are not configured"
      });
    }

    const authKey = Buffer
      .from(`${key}:${secret}`)
      .toString("base64");

    const razorpayOrderId =
      localOrder.razorpayOrderId || localOrder.id;

    const response = await fetch(
      `https://api.razorpay.com/v1/orders/${razorpayOrderId}/payments`,
      {
        headers: {
          Authorization: `Basic ${authKey}`
        }
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error:
          data.error?.description ||
          "Could not check Razorpay payment"
      });
    }

    const payments = Array.isArray(data.items)
      ? data.items
      : [];

    const capturedPayment = payments.find(
      payment =>
        payment.status === "captured"
    );

    if (!capturedPayment) {
      return res.status(200).json({
        success: true,
        paid: false,
        status: "Payment Pending",
        message: "No captured payment found"
      });
    }

    const updatedOrders = orders.map(order => {

      if (
        String(order.id) === String(orderId) ||
        String(order.razorpayOrderId) === String(orderId)
      ) {
        return {
          ...order,
          razorpayOrderId,
          paymentId: capturedPayment.id,
          status: "Paid",
          paidAt:
            capturedPayment.created_at
              ? new Date(
                  capturedPayment.created_at * 1000
                ).toISOString()
              : new Date().toISOString()
        };
      }

      return order;
    });

    await putJSON(
      "orders",
      updatedOrders
    );

    return res.status(200).json({
      success: true,
      paid: true,
      status: "Paid",
      paymentId: capturedPayment.id,
      orderId: razorpayOrderId
    });

  } catch (error) {

    console.error(
      "Payment status error:",
      error
    );

    return res.status(500).json({
      success: false,
      error:
        error.message ||
        "Payment status check failed"
    });
  }
};
