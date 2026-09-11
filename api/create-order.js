const crypto = require("crypto");
const { putJSON, getJSON } = require("../_store");

const SHIPPING_CHARGE = 49;
const MAX_QTY = 10;

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        error: "Method not allowed"
      });
    }

    const body = req.body || {};

    /* =========================
       PAYMENT METHOD
    ========================= */

    let paymentMethod = String(
      body.paymentMethod ||
      body.payment_method ||
      ""
    )
      .trim()
      .toUpperCase();

    if (paymentMethod === "CASH ON DELIVERY") {
      paymentMethod = "COD";
    }

    if (
      paymentMethod !== "COD" &&
      paymentMethod !== "ONLINE"
    ) {
      return res.status(400).json({
        error: "Invalid payment method"
      });
    }


    /* =========================
       CUSTOMER
    ========================= */

    const customerInput =
      body.customer || {};

    const customer = {
      name: String(
        customerInput.name ||
        body.name ||
        ""
      ).trim(),

      mobile: String(
        customerInput.mobile ||
        body.mobile ||
        ""
      ).trim(),

      address: String(
        customerInput.address ||
        body.address ||
        ""
      ).trim(),

      pincode: String(
        customerInput.pincode ||
        customerInput.pin ||
        body.pincode ||
        body.pin ||
        ""
      ).trim()
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
        error: "PIN code is required"
      });
    }


    /* =========================
       ITEMS
    ========================= */

    const rawItems =
      Array.isArray(body.items)
        ? body.items
        : Array.isArray(body.itemData)
        ? body.itemData
        : [];


    if (!rawItems.length) {
      return res.status(400).json({
        error: "Order items are missing"
      });
    }


    const items = rawItems
      .map(item => ({
        id: Number(item.id || 0),

        name: String(
          item.name || ""
        ).trim(),

        price: Number(
          item.price || 0
        ),

        qty: Math.min(
          MAX_QTY,
          Math.max(
            1,
            Number(item.qty || 1)
          )
        ),

        size: String(
          item.size || ""
        ).trim(),

        image: String(
          item.image || ""
        ).trim()
      }))
      .filter(
        item =>
          item.name &&
          Number.isFinite(item.price) &&
          item.price > 0
      );


    if (!items.length) {
      return res.status(400).json({
        error: "Invalid product information"
      });
    }


    /* =========================
       PRODUCT TOTAL
    ========================= */

    const productTotal =
      items.reduce(
        (sum, item) => {
          return (
            sum +
            Number(item.price) *
            Number(item.qty)
          );
        },
        0
      );


    if (
      !Number.isFinite(productTotal) ||
      productTotal <= 0
    ) {
      return res.status(400).json({
        error: "Invalid product total"
      });
    }


    /* =========================
       GRAND TOTAL
    ========================= */

    const grandTotal =
      productTotal +
      SHIPPING_CHARGE;


    /* =========================
       CUSTOMER TOKEN
    ========================= */

    const customerAccessToken =
      crypto.randomBytes(32).toString("hex");


    const createdAt =
      new Date().toISOString();


    /* =========================
       LOAD ORDERS
    ========================= */

    const orders =
      await getJSON(
        "orders",
        []
      );


    /* =====================================================
       COD ORDER
       IMPORTANT:
       COD DOES NOT CREATE A RAZORPAY ORDER
    ===================================================== */

    if (paymentMethod === "COD") {

      const orderId =
        "order_" +
        crypto.randomBytes(8)
          .toString("base64url");


      const receipt =
        body.receipt ||
        `COD-${Date.now()}`;


      const order = {

        id:
          orderId,

        receipt:
          receipt,

        amount:
          grandTotal,

        productTotal:
          productTotal,

        shippingCharge:
          SHIPPING_CHARGE,

        total:
          grandTotal,

        currency:
          "INR",


        customer:
          customer,


        items:
          items,


        itemData:
          items,


        address:
          customer.address,

        pin:
          customer.pincode,


        /* IMPORTANT */
        paymentMethod:
          "COD",

        payment_method:
          "COD",


        /* IMPORTANT */
        status:
          "Order Confirmed",


        customerAccessToken:
          customerAccessToken,


        razorpayOrderId:
          "",

        razorpayPaymentId:
          "",

        razorpaySignature:
          "",


        shiprocketOrderId:
          "",

        shiprocketShipmentId:
          "",

        awb:
          "",

        courier:
          "",


        createdAt:
          createdAt,

        updatedAt:
          createdAt

      };


      orders.push(order);


      await putJSON(
        "orders",
        orders
      );


      return res.status(200).json({

        ok:
          true,

        id:
          order.id,

        receipt:
          order.receipt,

        amount:
          order.amount,

        productTotal:
          order.productTotal,

        shippingCharge:
          order.shippingCharge,

        total:
          order.total,

        currency:
          "INR",

        paymentMethod:
          "COD",

        status:
          "Order Confirmed",

        items:
          order.items,

        customer:
          order.customer,

        customerAccessToken:
          customerAccessToken

      });

    }


    /* =====================================================
       ONLINE PAYMENT
       ONLY ONLINE COMES HERE
    ===================================================== */


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


    const razorpayAmount =
      Math.round(
        grandTotal * 100
      );


    if (
      !razorpayAmount ||
      razorpayAmount < 100
    ) {
      return res.status(400).json({
        error:
          "Invalid payment amount"
      });
    }


    const auth =
      Buffer
        .from(
          `${key}:${secret}`
        )
        .toString("base64");


    const razorpayResponse =
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
                body.receipt ||
                `SPW-${Date.now()}`,

              payment_capture:
                1

            })
        }
      );


    const razorpayData =
      await razorpayResponse.json();


    if (!razorpayResponse.ok) {
      return res.status(
        razorpayResponse.status
      ).json({
        error:
          razorpayData.error?.description ||
          "Razorpay order failed"
      });
    }


    /* =========================
       SAVE ONLINE ORDER
    ========================= */

    const onlineOrder = {

      id:
        razorpayData.id,

      razorpayOrderId:
        razorpayData.id,

      receipt:
        razorpayData.receipt,

      amount:
        razorpayData.amount / 100,

      productTotal:
        productTotal,

      shippingCharge:
        SHIPPING_CHARGE,

      total:
        grandTotal,

      currency:
        razorpayData.currency,


      customer:
        customer,


      items:
        items,


      itemData:
        items,


      address:
        customer.address,

      pin:
        customer.pincode,


      /* IMPORTANT */
      paymentMethod:
        "ONLINE",

      payment_method:
        "ONLINE",


      /* Payment not verified yet */
      status:
        "Payment Pending",


      customerAccessToken:
        customerAccessToken,


      razorpayPaymentId:
        "",

      razorpaySignature:
        "",


      shiprocketOrderId:
        "",

      shiprocketShipmentId:
        "",

      awb:
        "",

      courier:
        "",


      createdAt:
        createdAt,

      updatedAt:
        createdAt

    };


    orders.push(
      onlineOrder
    );


    await putJSON(
      "orders",
      orders
    );


    /* =========================
       ONLINE RESPONSE
    ========================= */

    return res.status(200).json({

      ok:
        true,

      id:
        razorpayData.id,

      amount:
        razorpayData.amount,

      currency:
        razorpayData.currency,

      key_id:
        key,

      paymentMethod:
        "ONLINE",

      status:
        "Payment Pending",

      customerAccessToken:
        customerAccessToken

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
