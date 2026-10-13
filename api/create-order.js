
const crypto = require("crypto");
const { putJSON, getJSON } = require("../_store");

const SHIPPING_CHARGE = 0;
const MAX_QTY = 10;

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const body = req.body || {};

    let paymentMethod = String(
      body.paymentMethod || body.payment_method || ""
    ).trim().toUpperCase();

    if (paymentMethod === "CASH ON DELIVERY") {
      paymentMethod = "COD";
    }

    if (!["COD", "ONLINE"].includes(paymentMethod)) {
      return res.status(400).json({ error: "Invalid payment method" });
    }

    const input = body.customer || {};

    const customer = {
      name: String(input.name || body.name || "").trim(),
      mobile: String(input.mobile || body.mobile || "").trim(),
      address: String(input.address || body.address || "").trim(),
      pincode: String(
        input.pincode || input.pin || body.pincode || body.pin || ""
      ).trim()
    };

    for (const field of ["name", "mobile", "address", "pincode"]) {
      if (!customer[field]) {
        return res.status(400).json({
          error: `${field} is required`
        });
      }
    }

    const rawItems = Array.isArray(body.items)
      ? body.items
      : Array.isArray(body.itemData)
      ? body.itemData
      : [];

    if (!rawItems.length) {
      return res.status(400).json({ error: "Order items are missing" });
    }

    const items = rawItems.map(item => {
      let selections = [];

      if (Array.isArray(item.colours)) {
        selections = item.colours.map(selection => {
          const colour = String(
            selection?.colour || selection?.color || ""
          ).trim();

          return {
            colour,
            color: colour,
            size: String(selection?.size || "").trim(),
            qty: Math.min(
              MAX_QTY,
              Math.max(1, Math.floor(Number(selection?.qty) || 1))
            )
          };
        }).filter(s => s.colour || s.size);
      }

      const directSize = String(item.size || "").trim();
      const directColour = String(item.colour || item.color || "").trim();
      const qty = Math.min(
        MAX_QTY,
        Math.max(1, Math.floor(Number(item.qty) || 1))
      );

      if (!selections.length && (directSize || directColour)) {
        selections = [{
          colour: directColour,
          color: directColour,
          size: directSize,
          qty
        }];
      }

      return {
        id: Number(item.id || 0),
        name: String(item.name || "").trim(),
        price: Number(item.price),
        qty,
        size: directSize || (selections.length === 1 ? selections[0].size : ""),
        colour: directColour || (selections.length === 1 ? selections[0].colour : ""),
        colours: selections,
        colors: selections,
        image: String(item.image || "").trim()
      };
    }).filter(item =>
      item.name &&
      Number.isFinite(item.price) &&
      item.price > 0
    );

    if (!items.length) {
      return res.status(400).json({
        error: "Invalid product information"
      });
    }

    const productTotal = items.reduce(
      (sum, item) => sum + item.price * item.qty,
      0
    );

    if (!Number.isFinite(productTotal) || productTotal <= 0) {
      return res.status(400).json({ error: "Invalid product total" });
    }

    const grandTotal = productTotal + SHIPPING_CHARGE;
    const customerAccessToken = crypto.randomBytes(32).toString("hex");
    const createdAt = new Date().toISOString();
    const orders = await getJSON("orders", []);

    if (paymentMethod === "COD") {
      const orderId = "order_" + crypto.randomBytes(8).toString("base64url");

      const order = {
        id: orderId,
        receipt: body.receipt || `COD-${Date.now()}`,
        amount: grandTotal,
        productTotal,
        shippingCharge: SHIPPING_CHARGE,
        total: grandTotal,
        currency: "INR",
        customer,
        items,
        itemData: items,
        address: customer.address,
        pin: customer.pincode,
        paymentMethod: "COD",
        payment_method: "COD",
        status: "Order Confirmed",
        customerAccessToken,
        razorpayOrderId: "",
        razorpayPaymentId: "",
        razorpaySignature: "",
        shiprocketOrderId: "",
        shiprocketShipmentId: "",
        awb: "",
        courier: "",
        createdAt,
        updatedAt: createdAt
      };

      orders.push(order);
      await putJSON("orders", orders);

      return res.status(200).json({
        ok: true,
        id: order.id,
        receipt: order.receipt,
        amount: order.amount,
        productTotal,
        shippingCharge: SHIPPING_CHARGE,
        total: order.total,
        currency: "INR",
        paymentMethod: "COD",
        status: order.status,
        items,
        customer,
        customerAccessToken
      });
    }

    const key = process.env.RAZORPAY_KEY_ID;
    const secret = process.env.RAZORPAY_KEY_SECRET;

    if (!key || !secret) {
      return res.status(500).json({
        error: "Razorpay keys are not configured"
      });
    }

    const razorpayAmount = Math.round(grandTotal * 100);

    if (razorpayAmount < 100) {
      return res.status(400).json({ error: "Invalid payment amount" });
    }

    const auth = Buffer.from(`${key}:${secret}`).toString("base64");

    const razorpayResponse = await fetch(
      "https://api.razorpay.com/v1/orders",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          amount: razorpayAmount,
          currency: "INR",
          receipt: body.receipt || `SPW-${Date.now()}`,
          payment_capture: 1
        })
      }
    );

    const razorpayData = await razorpayResponse.json();

    if (!razorpayResponse.ok) {
      return res.status(razorpayResponse.status).json({
        error: razorpayData.error?.description || "Razorpay order failed"
      });
    }

    const onlineOrder = {
      id: razorpayData.id,
      razorpayOrderId: razorpayData.id,
      receipt: razorpayData.receipt,
      amount: razorpayData.amount / 100,
      productTotal,
      shippingCharge: SHIPPING_CHARGE,
      total: grandTotal,
      currency: razorpayData.currency,
      customer,
      items,
      itemData: items,
      address: customer.address,
      pin: customer.pincode,
      paymentMethod: "ONLINE",
      payment_method: "ONLINE",
      status: "Payment Pending",
      customerAccessToken,
      razorpayPaymentId: "",
      razorpaySignature: "",
      shiprocketOrderId: "",
      shiprocketShipmentId: "",
      awb: "",
      courier: "",
      createdAt,
      updatedAt: createdAt
    };

    orders.push(onlineOrder);
    await putJSON("orders", orders);

    return res.status(200).json({
      ok: true,
      id: razorpayData.id,
      amount: razorpayData.amount,
      currency: razorpayData.currency,
      key_id: key,
      paymentMethod: "ONLINE",
      status: "Payment Pending",
      customerAccessToken,
      items
    });
  } catch (error) {
    console.error("Create order error:", error);

    return res.status(500).json({
      error: error.message || "Server error"
    });
  }
};
