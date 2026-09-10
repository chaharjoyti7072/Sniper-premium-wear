const { putJSON, getJSON } = require("../_store");

const SHIPPING_CHARGE = 49;

module.exports = async (req, res) => {
  try {

    if (req.method !== "POST") {
      return res.status(405).json({
        error: "Method not allowed"
      });
    }

    const {
      receipt,
      customer,
      items,
      address,
      pin,
      paymentMethod
    } = req.body || {};

    /* =========================
       BASIC VALIDATION
    ========================= */

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: "Order items are missing"
      });
    }

    if (!customer || !customer.name || !customer.mobile) {
      return res.status(400).json({
        error: "Customer details are required"
      });
    }

    if (!address || !pin) {
      return res.status(400).json({
        error: "Delivery address and PIN are required"
      });
    }

    /* =========================
       CALCULATE PRODUCT TOTAL
    ========================= */

    const productTotal = items.reduce((sum, item) => {

      const price = Number(item.price || 0);
      const qty = Number(item.qty || 0);

      if (
        !Number.isFinite(price) ||
        !Number.isFinite(qty) ||
        price <= 0 ||
        qty <= 0
      ) {
        return sum;
      }

      return sum + price * qty;

    }, 0);

    if (!productTotal || productTotal <= 0) {
      return res.status(400).json({
        error: "Invalid product total"
      });
    }

    const grandTotal =
      productTotal + SHIPPING_CHARGE;


    /* =========================
       COD ORDER
    ========================= */

    if (paymentMethod === "COD") {

      const orders =
        await getJSON("orders", []);

      const orderId =
        receipt ||
        `COD-${Date.now()}`;

      const codOrder = {

        id: orderId,

        razorpayOrderId: "",

        paymentId: "",

        receipt: orderId,

        amount: grandTotal,

        productTotal: productTotal,

        shippingCharge: SHIPPING_CHARGE,

        total: grandTotal,

        currency: "INR",

        customer: {
          name: String(customer.name).trim(),
          mobile: String(customer.mobile).trim()
        },

        items: items.map(item => ({
          id: item.id,
          name: String(item.name || ""),
          price: Number(item.price || 0),
          qty: Number(item.qty || 0),
          size: String(item.size || "")
        })),

        address: String(address).trim(),

        pin: String(pin).trim(),

        paymentMethod: "COD",

        status: "COD - Pending",

        createdAt: new Date().toISOString()

      };

      orders.push(codOrder);

      await putJSON(
        "orders",
        orders
      );

      return res.status(200).json({

        ok: true,

        cod: true,

        id: orderId,

        amount: grandTotal,

        currency: "INR",

        paymentMethod: "COD"

      });

    }


    /* =========================
       ONLINE PAYMENT
    ========================= */

    const razorpayAmount =
      Math.round(grandTotal * 100);

    if (
      !razorpayAmount ||
      razorpayAmount < 100
    ) {
      return res.status(400).json({
        error: "Invalid payment amount"
      });
    }


    const key =
      process.env.RAZORPAY_KEY_ID;

    const secret =
      process.env.RAZORPAY_KEY_SECRET;


    if (!key || !secret) {

      return res.status(500).json({
        error:
          "Razorpay keys are not configured in Vercel"
      });

    }


    const auth =
      Buffer
        .from(`${key}:${secret}`)
        .toString("base64");


    const response =
      await fetch(
        "https://api.razorpay.com/v1/orders",
        {

          method: "POST",

          headers: {
            Authorization:
              `Basic ${auth}`,

            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({

              amount:
                razorpayAmount,

              currency:
                "INR",

              receipt:
                receipt ||
                `SPW-${Date.now()}`,

              payment_capture:
                1

            })

        }
      );


    const data =
      await response.json();


    if (!response.ok) {

      return res.status(
        response.status
      ).json({

        error:
          data.error?.description ||
          "Razorpay order failed"

      });

    }


    /* =========================
       SAVE ONLINE ORDER
    ========================= */

    const orders =
      await getJSON(
        "orders",
        []
      );


    orders.push({

      id:
        data.id,

      razorpayOrderId:
        data.id,

      receipt:
        data.receipt,

      amount:
        data.amount / 100,

      productTotal:
        productTotal,

      shippingCharge:
        SHIPPING_CHARGE,

      total:
        grandTotal,

      currency:
        data.currency,

      customer:
        customer || {},

      items:
        items || [],

      address:
        address || "",

      pin:
        pin || "",

      paymentMethod:
        "ONLINE",

      status:
        "Payment Pending",

      createdAt:
        new Date().toISOString()

    });


    await putJSON(
      "orders",
      orders
    );


    return res.status(200).json({

      ok: true,

      cod: false,

      id:
        data.id,

      amount:
        data.amount,

      currency:
        data.currency,

      key_id:
        key

    });


  } catch (error) {

    console.error(
      "Create order error:",
      error
    );

    return res.status(500).json({

      error:
        error.message ||
        "Server error"

    });

  }

};
