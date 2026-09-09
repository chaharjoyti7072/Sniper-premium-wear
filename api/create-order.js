const { putJSON, getJSON } = require("../_store");

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        error: "Method not allowed"
      });
    }

    const {
      amount,
      receipt,
      customer,
      items,
      address,
      pin
    } = req.body || {};

    if (!amount || Number(amount) < 100) {
      return res.status(400).json({
        error: "Invalid amount"
      });
    }

    const key = process.env.RAZORPAY_KEY_ID;
    const secret = process.env.RAZORPAY_KEY_SECRET;

    if (!key || !secret) {
      return res.status(500).json({
        error: "Razorpay keys are not configured in Vercel"
      });
    }

    const auth = Buffer
      .from(`${key}:${secret}`)
      .toString("base64");

    const response = await fetch(
      "https://api.razorpay.com/v1/orders",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          amount: Number(amount),
          currency: "INR",
          receipt: receipt || `SPW-${Date.now()}`,
          payment_capture: 1
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error:
          data.error?.description ||
          "Razorpay order failed"
      });
    }

    const orders = await getJSON("orders", []);

    orders.push({
      id: data.id,
      razorpayOrderId: data.id,
      receipt: data.receipt,
      amount: data.amount / 100,
      currency: data.currency,
      customer: customer || {},
      items: items || [],
      address: address || "",
      pin: pin || "",
      status: "Payment Pending",
      createdAt: new Date().toISOString()
    });

    await putJSON("orders", orders);

    return res.status(200).json({
      id: data.id,
      amount: data.amount,
      currency: data.currency,
      key_id: key
    });

  } catch (error) {
    console.error("Create order error:", error);

    return res.status(500).json({
      error: error.message || "Server error"
    });
  }
};
