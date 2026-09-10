const { getJSON, putJSON } = require("../_store");
const { createShiprocketOrder } = require("./shiprocket");

module.exports = async (req, res) => {
  try {

    // Only POST allowed
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        message: "Method not allowed"
      });
    }

    // Admin authentication
    const auth = req.headers.authorization;

    if (
      !process.env.ADMIN_PASSWORD ||
      auth !== `Bearer ${process.env.ADMIN_PASSWORD}`
    ) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    const { order_id } = req.body || {};

    if (!order_id) {
      return res.status(400).json({
        success: false,
        message: "Order ID is missing"
      });
    }


    // Get local orders
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


    // ------------------------------------------------
    // IMPORTANT:
    // If already created in Shiprocket,
    // do NOT create duplicate order.
    // ------------------------------------------------

    if (localOrder.shiprocketOrderId) {

      return res.status(200).json({
        success: true,
        alreadyCreated: true,
        message: "Order is already created in Shiprocket",

        shiprocket: {
          order_id:
            localOrder.shiprocketOrderId,

          shipment_id:
            localOrder.shiprocketShipmentId || "",

          status:
            localOrder.shiprocketStatus || "Created"
        }
      });

    }


    // Customer information
    const customer =
      localOrder.customer || {};

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


    // Validate delivery information
    if (
      !name ||
      !mobile ||
      !address ||
      !pin
    ) {

      return res.status(400).json({
        success: false,
        message: "Customer delivery details are missing",

        details: {
          name: !!name,
          mobile: !!mobile,
          address: !!address,
          pin: !!pin
        }
      });

    }


    // Validate products
    if (
      !Array.isArray(localOrder.items) ||
      localOrder.items.length === 0
    ) {

      return res.status(400).json({
        success: false,
        message: "Order items are missing"
      });

    }


    // Prepare Shiprocket order
    const shiprocketOrder = {

      order_id:
        "SPW-" + String(localOrder.id),

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
            item.name ||
            "Product",

          qty:
            Number(item.qty || 1),

          price:
            Number(item.price || 0)
        }))
    };


    // Create in Shiprocket
    const result =
      await createShiprocketOrder(
        shiprocketOrder
      );


    // ------------------------------------------------
    // Get IDs from Shiprocket response
    // ------------------------------------------------

    const shiprocketOrderId =
      result?.order_id ||
      result?.data?.order_id ||
      result?.orderId ||
      result?.data?.orderId ||
      result?.id ||
      "";

    const shipmentId =
      result?.shipment_id ||
      result?.data?.shipment_id ||
      result?.shipmentId ||
      result?.data?.shipmentId ||
      "";


    // ------------------------------------------------
    // Save Shiprocket information
    // ------------------------------------------------

    orders[index] = {

      ...localOrder,

      shiprocketOrderId:
        String(shiprocketOrderId || ""),

      shiprocketShipmentId:
        String(shipmentId || ""),

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


    // ------------------------------------------------
    // Success response
    // ------------------------------------------------

    return res.status(200).json({

      success: true,

      alreadyCreated: false,

      message:
        "Order sent to Shiprocket successfully",

      shiprocket: {

        order_id:
          shiprocketOrderId,

        shipment_id:
          shipmentId,

        status:
          "Created"
      }

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
