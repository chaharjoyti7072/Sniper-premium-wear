const crypto = require("crypto");
const { getJSON, putJSON } = require("../_store");

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        verified: false,
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

    const received = Buffer.from(
      razorpay_signature,
      "utf8"
    );

    const generated = Buffer.from(
      generatedSignature,
      "utf8"
    );

    if (
      received.length !== generated.length ||
      !crypto.timingSafeEqual(received, generated)
    ) {
      return res.status(400).json({
        verified: false,
        error: "Payment signature verification failed"
      });
    }

    const auth = Buffer
      .from(
        `${process.env.RAZORPAY_KEY_ID}:${secret}`
      )
      .toString("base64");

    const paymentResponse = await fetch(
      `https://api.razorpay.com/v1/payments/${razorpay_payment_id}`,
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${auth}`
        }
      }
    );

    const payment = await paymentResponse.json();

    if (!paymentResponse.ok) {
      return res.status(400).json({
        verified: false,
        error:
          payment.error?.description ||
          "Unable to verify payment status"
      });
    }

    if (
      payment.order_id !== razorpay_order_id
    ) {
      return res.status(400).json({
        verified: false,
        error: "Payment order mismatch"
      });
    }

    if (
      payment.status !== "captured"
    ) {
      return res.status(400).json({
        verified: false,
        error:
          "Payment is not captured yet"
      });
    }

    const orders =
      await getJSON("orders", []);

    let found = false;

    const updatedOrders =
      orders.map(order => {

        if (
          order.razorpayOrderId ===
            razorpay_order_id ||
          order.id === razorpay_order_id
        ) {

          found = true;

          return {
            ...order,
            paymentId:
              razorpay_payment_id,
            razorpayOrderId:
              razorpay_order_id,
            status: "Paid",
            paidAt:
              new Date().toISOString()
          };
        }

        return order;
      });

    if (!found) {
      return res.status(404).json({
        verified: false,
        error: "Order not found"
      });
    }

    await putJSON(
      "orders",
      updatedOrders
    );

    return res.status(200).json({
      verified: true,
      paymentId:
        razorpay_payment_id,
      orderId:
        razorpay_order_id,
      status: "Paid"
    });

  } catch (error) {

    console.error(
      "Payment verification error:",
      error
    );

    return res.status(500).json({
      verified: false,
      error:
        error.message ||
        "Payment verification failed"
    });
  }
};
