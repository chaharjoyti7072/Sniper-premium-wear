const crypto = require("crypto");
const { getJSON, putJSON } = require("../_store");

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        error: "Method not allowed"
      });
    }

    const body = req.body || {};

    const customer = {
      name: String(body.name || "").trim(),
      mobile: String(body.mobile || "").trim(),
      address: String(body.address || "").trim(),
      pincode: String(body.pincode || "").trim()
    };

    if (!customer.name) {
      return res.status(400).json({
        error: "Name is required"
      });
    }

    if (!customer.mobile) {
      return res.status(400).json({
        error: "Mobile number is required"
      });
    }

    if (!customer.address) {
      return res.status(400).json({
        error: "Address is required"
      });
    }

    if (!customer.pincode) {
      return res.status(400).json({
        error: "Pincode is required"
      });
    }

    /*
      Support both:
      - items
      - itemData
    */
    const rawItems = Array.isArray(body.items)
      ? body.items
      : Array.isArray(body.itemData)
      ? body.itemData
      : [];

    if (!rawItems.length) {
      return res.status(400).json({
        error: "At least one product is required"
      });
    }

    const items = rawItems
      .map(item => ({
        id: Number(item.id || 0),
        name: String(item.name || "").trim(),
        qty: Math.max(1, Number(item.qty || 1)),
        size: String(item.size || "").trim(),
        price: Number(item.price || 0),
        image: String(item.image || "").trim()
      }))
      .filter(item => item.name);

    if (!items.length) {
      return res.status(400).json({
        error: "Invalid products"
      });
    }

    /*
      Maximum 10 quantity for each product/size.
    */
    for (const item of items) {
      if (item.qty > 10) {
        return res.status(400).json({
          error: "Maximum 10 quantity allowed for one product/size."
        });
      }
    }

    /*
      Calculate product total from the submitted products.
    */
    const calculatedProductTotal = items.reduce(
      (sum, item) => {
        return sum + Number(item.price || 0) * Number(item.qty || 0);
      },
      0
    );

    /*
      Website shipping charge = ₹49 per order.
    */
    const shippingCharge = 49;

    const calculatedTotal =
      calculatedProductTotal + shippingCharge;

    /*
      Accept payment method from frontend.
      COD must NEVER become ONLINE.
    */
    let paymentMethod = String(
      body.paymentMethod || body.payment_method || ""
    )
      .trim()
      .toUpperCase();

    if (paymentMethod === "CASH ON DELIVERY") {
      paymentMethod = "COD";
    }

    if (paymentMethod !== "COD" && paymentMethod !== "ONLINE") {
      paymentMethod = "COD";
    }

    /*
      ONLINE orders wait for Razorpay payment confirmation.
      COD orders are confirmed immediately.
    */
    const status =
      paymentMethod === "COD"
        ? "Order Confirmed"
        : "Payment Pending";

    const orderId =
      "order_" +
      crypto.randomBytes(8).toString("base64url");

    const receipt =
      "JOYTI-" +
      Date.now().toString().slice(-8);

    const customerAccessToken =
      crypto.randomBytes(32).toString("hex");

    const createdAt = new Date().toISOString();

    const order = {
      id: orderId,
      receipt,

      amount: calculatedTotal,
      productTotal: calculatedProductTotal,
      shippingCharge,
      total: calculatedTotal,
      currency: "INR",

      customer,

      /*
        Keep both fields for compatibility
        with existing frontend/backend.
      */
      items,
      itemData: items,

      paymentMethod,
      payment_method: paymentMethod,

      status,

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

    const orders = await getJSON("orders", []);

    orders.push(order);

    await putJSON("orders", orders);

    return res.status(200).json({
      ok: true,

      order: {
        id: order.id,
        receipt: order.receipt,
        amount: order.amount,
        productTotal: order.productTotal,
        shippingCharge: order.shippingCharge,
        total: order.total,
        currency: order.currency,
        items: order.items,
        customer: order.customer,
        paymentMethod: order.paymentMethod,
        status: order.status,
        createdAt: order.createdAt
      },

      customerAccessToken
    });

  } catch (error) {
    console.error("Create order error:", error);

    return res.status(500).json({
      error: error.message || "Unable to create order"
    });
  }
};
