const { getJSON, putJSON } = require("../_store");
const { createShiprocketOrder } = require("./shiprocket");

module.exports = async (req, res) => {

  try {

    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        message: "Method not allowed"
      });
    }

    const { order_id } = req.body || {};

    if (!order_id) {
      return res.status(400).json({
        success: false,
        message: "Order ID is missing"
      });
    }


    // Get all local orders
    const orders = await getJSON("orders", []);


    // Find selected order
    const index = orders.findIndex(order =>
      String(order.id) === String(order_id)
    );


    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }


    const localOrder = orders[index];

    const customer =
      localOrder.customer || {};


    // Delivery details
    const name =
      customer.name ||
      localOrder.name ||
      "";

    const mobile =
      customer.mobile ||
      localOrder.mobile ||
      "";

    const email =
      customer.email ||
      localOrder.email ||
      "";

    const address =
      localOrder.address ||
      customer.address ||
      "";

    const pin =
      localOrder.pin ||
      customer.pin ||
      "";


    if (!name || !mobile || !address || !pin) {

      return res.status(400).json({
        success: false,
        message:
          "Customer delivery details are missing",
        details: {
          name: !!name,
          mobile: !!mobile,
          address: !!address,
          pin: !!pin
        }
      });

    }


    if (
      !Array.isArray(localOrder.items) ||
      localOrder.items.length === 0
    ) {

      return res.status(400).json({
        success: false,
        message: "Order items are missing"
      });

    }


    // Prepare order for Shiprocket
    const shiprocketOrder = {

      order_id:
        "SPW-" +
        String(localOrder.id),

      name: name,

      mobile: mobile,

      email: email,

      address: address,

      pin: pin,

      total:
        Number(
          localOrder.amount ||
          localOrder.total ||
          0
        ),

      payment:
        localOrder.status === "Paid"
        ? "Prepaid"
        : "COD",

      items:
        localOrder.items.map(item => ({

          id:
            item.id ||
            Date.now(),

          name:
            item.name || "Product",

          qty:
            Number(item.qty || 1),

          price:
            Number(item.price || 0)

        }))

    };


    // Create order in Shiprocket
    const result =
      await createShiprocketOrder(
        shiprocketOrder
      );


    // Save Shiprocket details
    orders[index] = {

      ...localOrder,

      shiprocketOrderId:
        result.order_id ||
        result.order_id ||
        result.id ||
        "",

      shiprocketShipmentId:
        result.shipment_id ||
        "",

      shiprocketStatus:
        "Created",

      shiprocketResponse:
        result,

      updatedAt:
        new Date().toISOString()

    };


    await putJSON(
      "orders",
      orders
    );


    return res.status(200).json({

      success: true,

      message:
        "Order created in Shiprocket",

      shiprocket:
        result

    });


  } catch (error) {

    console.error(
      "Shiprocket order error:",
      error
    );

    return res.status(500).json({

      success: false,

      message:
        error.message ||
        "Shiprocket order failed"

    });

  }

};
