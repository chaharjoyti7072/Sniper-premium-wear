const { getJSON, putJSON } = require("../_store");

const {
  getShiprocketToken,
  createShiprocketOrder
} = require("./shiprocket");

module.exports = async (req, res) => {
  try {

    // METHOD CHECK
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        message: "Method not allowed"
      });
    }


    // ADMIN AUTH
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


    // ORDER ID
    const { order_id } = req.body || {};

    if (!order_id) {
      return res.status(400).json({
        success: false,
        message: "Order ID is missing"
      });
    }


    // GET LOCAL ORDERS
    const orders = await getJSON("orders", []);


    const index = orders.findIndex(
      order =>
        String(order.id) === String(order_id)
    );


    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }


    const localOrder = orders[index];


    // ALREADY CREATED CHECK
    if (localOrder.shiprocketOrderId) {

      return res.status(200).json({
        success: true,
        alreadyCreated: true,
        message: "Shiprocket order already created",
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


    // CUSTOMER DETAILS
    const customer =
      localOrder.customer || {};


    const name =
      customer.name ||
      localOrder.name ||
      "Customer";


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


    // REQUIRED DETAILS CHECK
    if (
      !name ||
      !mobile ||
      !address ||
      !pin
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Customer delivery details are missing"
      });
    }


    // ITEMS CHECK
    if (
      !Array.isArray(localOrder.items) ||
      localOrder.items.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Order items are missing"
      });
    }


    // TOTAL
    const total = Number(
      localOrder.amount ||
      localOrder.total ||
      0
    );


    if (!total || total <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid order amount"
      });
    }


    // GET SHIPROCKET TOKEN
    await getShiprocketToken();


    // CREATE SHIPROCKET ORDER
    const shiprocketOrder = {

      // IMPORTANT:
      // This is our website order reference
      order_id:
        String(localOrder.id),


      name:
        String(name),


      mobile:
        String(mobile),


      email:
        String(email),


      address:
        String(address),


      pin:
        String(pin),


      total:
        total,


      // Razorpay Paid order = Prepaid
      payment:
        localOrder.status === "Paid"
          ? "Prepaid"
          : "COD",


      items:
        localOrder.items.map((item, index) => ({

          id:
            item.id ||
            `${localOrder.id}-${index + 1}`,

          name:
            item.name ||
            "Product",

          qty:
            Number(item.qty || 1),

          price:
            Number(item.price || 0)

        }))

    };


    console.log(
      "Creating Shiprocket order:",
      shiprocketOrder
    );


    // CREATE
    const result =
      await createShiprocketOrder(
        shiprocketOrder
      );


    console.log(
      "Shiprocket response:",
      result
    );


    // GET SHIPROCKET ORDER ID
    const shiprocketOrderId =
      String(
        result?.order_id ||
        result?.data?.order_id ||
        result?.orderId ||
        result?.data?.orderId ||
        result?.id ||
        ""
      );


    // GET SHIPMENT ID
    const shipmentId =
      String(
        result?.shipment_id ||
        result?.data?.shipment_id ||
        result?.shipmentId ||
        result?.data?.shipmentId ||
        result?.shipments?.[0]?.id ||
        ""
      );


    // IMPORTANT:
    // If Shiprocket did not return an ID,
    // do not pretend creation succeeded.
    if (!shiprocketOrderId) {

      console.error(
        "Shiprocket returned no order ID:",
        result
      );

      return res.status(502).json({
        success: false,
        message:
          "Shiprocket did not return an Order ID",
        response: result
      });
    }


    // SAVE INTO OUR ORDERS
    orders[index] = {

      ...localOrder,

      shiprocketOrderId:
        shiprocketOrderId,

      shiprocketShipmentId:
        shipmentId,

      shiprocketStatus:
        "Created",

      shiprocketResponse:
        result,

      shiprocketCreatedAt:
        new Date().toISOString(),

      updatedAt:
        new Date().toISOString()

    };


    await putJSON(
      "orders",
      orders
    );


    // SUCCESS
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
