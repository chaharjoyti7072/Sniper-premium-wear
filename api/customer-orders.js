const { getJSON } = require("../_store");

module.exports = async (req, res) => {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({
        error: "Method not allowed"
      });
    }

    const token = String(
      req.query.token || ""
    ).trim();

    if (!token) {
      return res.status(400).json({
        error: "Customer token is required"
      });
    }

    const orders = await getJSON(
      "orders",
      []
    );

    const customerOrders = orders
      .filter(order => {
        return (
          order &&
          order.customerAccessToken &&
          order.customerAccessToken === token
        );
      })
      .map(order => ({
        id: order.id,

        receipt:
          order.receipt || "",

        amount: Number(
          order.amount ||
          order.total ||
          0
        ),

        productTotal: Number(
          order.productTotal || 0
        ),

        shippingCharge: Number(
          order.shippingCharge || 49
        ),

        total: Number(
          order.total ||
          order.amount ||
          0
        ),

        currency:
          order.currency || "INR",

        customer: {
          name:
            order.customer?.name || ""
        },

        items:
          Array.isArray(order.items)
            ? order.items.map(item => ({
                name:
                  item.name || "",

                qty: Number(
                  item.qty || 0
                ),

                size:
                  item.size || ""
              }))
            : [],

        paymentMethod:
          order.paymentMethod ||
          "ONLINE",

        status:
          order.status ||
          "Payment Pending",

        shiprocketOrderId:
          order.shiprocketOrderId ||
          "",

        shiprocketShipmentId:
          order.shiprocketShipmentId ||
          "",

        awb:
          order.awb || "",

        courier:
          order.courier || "",

        createdAt:
          order.createdAt || ""
      }));

    return res.status(200).json({
      ok: true,
      orders: customerOrders
    });

  } catch (error) {

    console.error(
      "Customer orders error:",
      error
    );

    return res.status(500).json({
      error:
        error.message ||
        "Unable to load customer orders"
    });
  }
};
