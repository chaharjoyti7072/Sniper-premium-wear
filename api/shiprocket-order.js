const { getJSON, putJSON } = require("../_store");
const {
  getShiprocketToken,
  createShiprocketOrder
} = require("./shiprocket");

const BASE_URL =
  "https://apiv2.shiprocket.in/v1/external";

async function getExistingShiprocketOrder(token, localOrder) {

  const candidates = [
    String(localOrder.id || ""),
    String(localOrder.razorpayOrderId || ""),
    "SPW-" + String(localOrder.id || ""),
    String(localOrder.receipt || "")
  ].filter(Boolean);

  let page = 1;

  while (page <= 20) {

    const response = await fetch(
      `${BASE_URL}/orders?per_page=100&page=${page}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      break;
    }

    const data = await response.json();

    const list =
      Array.isArray(data.data)
        ? data.data
        : [];

    const found = list.find(order => {

      const channelOrderId =
        String(
          order.channel_order_id || ""
        );

      const shiprocketId =
        String(
          order.id || ""
        );

      return (
        candidates.includes(channelOrderId) ||
        candidates.includes(shiprocketId)
      );

    });

    if (found) {
      return found;
    }

    const pagination =
      data.meta?.pagination;

    const totalPages =
      Number(
        pagination?.total_pages || 1
      );

    if (page >= totalPages) {
      break;
    }

    page++;
  }

  return null;
}


async function getShiprocketDetails(
  token,
  orderId
) {

  if (!orderId) {
    return null;
  }

  try {

    const response = await fetch(
      `${BASE_URL}/orders/show/${encodeURIComponent(orderId)}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      }
    );

    if (!response.ok) {
      return null;
    }

    const data =
      await response.json();

    return data.data || data;

  } catch (error) {

    console.error(
      "Shiprocket details error:",
      error
    );

    return null;
  }
}


function getShipmentId(order) {

  return String(
    order?.shipment_id ||
    order?.shipments?.[0]?.id ||
    order?.shipment?.id ||
    ""
  );

}


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


    // Get Shiprocket login token
    const token =
      await getShiprocketToken();


    // =================================================
    // FIRST: SEARCH EXISTING SHIPROCKET ORDER
    // =================================================

    const existing =
      await getExistingShiprocketOrder(
        token,
        localOrder
      );


    if (existing) {

      const shiprocketId =
        String(
          existing.id || ""
        );


      // Get complete order/shipment details
      const details =
        await getShiprocketDetails(
          token,
          shiprocketId
        );


      const finalOrder =
        details || existing;


      const shipmentId =
        getShipmentId(finalOrder);


      orders[index] = {

        ...localOrder,

        shiprocketOrderId:
          shiprocketId,

        shiprocketShipmentId:
          shipmentId,

        shiprocketStatus:
          finalOrder.status ||
          existing.status ||
          "Created",

        shiprocketResponse:
          finalOrder,

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
          "Existing Shiprocket order connected",

        shiprocket: {

          order_id:
            shiprocketId,

          shipment_id:
            shipmentId,

          status:
            finalOrder.status ||
            existing.status ||
            "Created"

        }

      });

    }


    // =================================================
    // CUSTOMER DETAILS
    // =================================================

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
          "Customer delivery details are missing"

      });

    }


    // =================================================
    // ITEMS
    // =================================================

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


    // =================================================
    // IMPORTANT:
    // Do NOT automatically create a duplicate order
    // if we cannot find the old one.
    // =================================================

    if (
      localOrder.shiprocketAttempted
    ) {

      return res.status(409).json({

        success: false,

        message:
          "Existing Shiprocket order could not be found. New order was NOT created to avoid duplicate shipment."

      });

    }


    // =================================================
    // CREATE NEW SHIPROCKET ORDER
    // =================================================

    const shiprocketOrder = {

      order_id:
        String(localOrder.id),

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


    const shiprocketOrderId =
      String(
        result?.order_id ||
        result?.data?.order_id ||
        result?.orderId ||
        result?.data?.orderId ||
        result?.id ||
        ""
      );


    const shipmentId =
      String(
        result?.shipment_id ||
        result?.data?.shipment_id ||
        result?.shipmentId ||
        result?.data?.shipmentId ||
        result?.shipments?.[0]?.id ||
        ""
      );


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

      shiprocketAttempted:
        true,

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
