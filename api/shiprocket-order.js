const { getJSON, putJSON } = require("../_store");
const {
  getShiprocketToken,
  createShiprocketOrder
} = require("./shiprocket");

const BASE_URL =
  "https://apiv2.shiprocket.in/v1/external";

module.exports = async (req, res) => {

  try {

    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        message: "Method not allowed"
      });
    }

    const auth =
      req.headers.authorization;

    if (
      !process.env.ADMIN_PASSWORD ||
      auth !==
        `Bearer ${process.env.ADMIN_PASSWORD}`
    ) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized"
      });
    }

    const { order_id } =
      req.body || {};

    if (!order_id) {
      return res.status(400).json({
        success: false,
        message: "Order ID is missing"
      });
    }


    // ==============================
    // LOCAL ORDERS
    // ==============================

    const orders =
      await getJSON("orders", []);

    const index =
      orders.findIndex(order =>
        String(order.id) ===
        String(order_id)
      );

    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    const localOrder =
      orders[index];


    // ==============================
    // ALREADY SAVED LOCALLY
    // ==============================

    if (localOrder.shiprocketOrderId) {

      return res.status(200).json({
        success: true,
        alreadyCreated: true,
        message:
          "Order already connected with Shiprocket",

        shiprocket: {
          order_id:
            localOrder.shiprocketOrderId,

          shipment_id:
            localOrder.shiprocketShipmentId ||
            "",

          status:
            localOrder.shiprocketStatus ||
            "Created"
        }
      });

    }


    // ==============================
    // SHIPROCKET TOKEN
    // ==============================

    const token =
      await getShiprocketToken();


    // ==============================
    // CHECK EXISTING SHIPROCKET ORDER
    // ==============================

    const ourOrderId =
      "SPW-" +
      String(localOrder.id);


    const existingResponse =
      await fetch(
        `${BASE_URL}/orders`,
        {
          method: "GET",
          headers: {
            "Authorization":
              `Bearer ${token}`
          }
        }
      );


    if (existingResponse.ok) {

      const existingData =
        await existingResponse.json();

      const existingOrders =
        Array.isArray(
          existingData.data
        )
          ? existingData.data
          : [];


      const existing =
        existingOrders.find(order =>
          String(
            order.channel_order_id || ""
          ) === String(ourOrderId)
        );


      // ==============================
      // EXISTING ORDER FOUND
      // ==============================

      if (existing) {

        const shipmentId =
          existing.shipments?.[0]?.id ||
          existing.shipment_id ||
          "";

        orders[index] = {

          ...localOrder,

          shiprocketOrderId:
            String(
              existing.id || ""
            ),

          shiprocketShipmentId:
            String(
              shipmentId || ""
            ),

          shiprocketStatus:
            existing.status ||
            "Created",

          updatedAt:
            new Date().toISOString()
        };


        await putJSON(
          "orders",
          orders
        );


        return res.status(200).json({

          success: true,

          alreadyCreated: true,

          message:
            "Existing Shiprocket order found and connected",

          shiprocket: {

            order_id:
              existing.id,

            shipment_id:
              shipmentId,

            status:
              existing.status ||
              "Created"
          }

        });

      }

    }


    // ==============================
    // CUSTOMER DETAILS
    // ==============================

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


    if (
      !name ||
      !mobile ||
      !address ||
      !pin
    ) {

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


    // ==============================
    // ITEMS
    // ==============================

    if (
      !Array.isArray(
        localOrder.items
      ) ||
      localOrder.items.length === 0
    ) {

      return res.status(400).json({
        success: false,
        message:
          "Order items are missing"
      });

    }


    // ==============================
    // CREATE NEW SHIPROCKET ORDER
    // ==============================

    const shiprocketOrder = {

      order_id:
        ourOrderId,

      name:
        name,

      mobile:
        mobile,

      email:
        email,

      address:
        address,

      pin:
        pin,

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
            Number(
              item.qty || 1
            ),

          price:
            Number(
              item.price || 0
            )

        }))

    };


    const result =
      await createShiprocketOrder(
        shiprocketOrder
      );


    // ==============================
    // GET SHIPROCKET IDs
    // ==============================

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
      result?.shipments?.[0]?.id ||
      "";


    // ==============================
    // SAVE
    // ==============================

    orders[index] = {

      ...localOrder,

      shiprocketOrderId:
        String(
          shiprocketOrderId
        ),

      shiprocketShipmentId:
        String(
          shipmentId
        ),

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
