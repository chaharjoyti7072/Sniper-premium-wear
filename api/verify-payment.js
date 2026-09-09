const crypto = require("crypto");
const { getJSON, putJSON } = require("../_store");

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        error: "Method not allowed"
      });
    }

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body || {};

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return res.status(400).json({
        verified: false,
        error: "Payment details are missing"
      });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;

    if (!secret) {
      return res.status(500).json({
        verified: false,
        error: "Razorpay secret is not configured"
      });
    }

    const generatedSignature = crypto
      .createHmac("sha256", secret)
      .update(
        `${razorpay_order_id}|${razorpay_payment_id}`
      )
      .digest("hex");

    if (
      generatedSignature !== razorpay_signature
    ) {
      return res.status(400).json({
        verified: false,
        error: "Payment signature verification failed"
      });
    }

    const orders = await getJSON("orders", []);

    const updatedOrders = orders.map(order => {

      if (
        order.razorpayOrderId === razorpay_order_id ||
        order.id === razorpay_order_id
      ) {
        return {
          ...order,
          paymentId: razorpay_payment_id,
          razorpayOrderId: razorpay_order_id,
          status: "Paid",
          paidAt: new Date().toISOString()
        };
      }

      return order;

    });

    await putJSON("orders", updatedOrders);

    return res.status(200).json({
      verified: true,
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id
    });

  } catch (error) {

    console.error(
      "Payment verification error:",
      error
    );

    return res.status(500).json({
      verified: false,
      error: error.message || "Payment verification failed"
    });
  }
};
