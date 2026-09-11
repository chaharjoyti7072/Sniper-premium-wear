const { getJSON } = require("../_store");

function normalizeMobile(value) {
  return String(value || "")
    .replace(/\D/g, "")
    .slice(-10);
}

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

    const mobile = normalizeMobile(
      req.query.mobile || ""
    );

    const orderId = String(
      req.query.orderId || ""
    ).trim();

    if (!orderId) {
      return res.status(400).json({
        error: "Order ID is required"
      });
    }

    if (!token && !mobile) {
      return res.status(400).json({
        error: "Mobile number is required"
      });
    }

    const orders = await getJSON(
      "orders",
      []
    );

    const order = orders.find(item => {

      if (!item) {
        return false;
      }

      if (
        String(item.id || "").trim() !==
        orderId
      ) {
        return false;
      }

      // Existing secure token system
      if (
        token &&
        item.customerAccessToken &&
        item.customerAccessToken === token
      ) {
        return true;
      }

      // New Mobile + Order ID system
      if (mobile) {

        const savedMobile =
          normalizeMobile(
            item.customer?.mobile ||
            item.mobile ||
            ""
          );

        return (
          savedMobile === mobile
        );
      }

      return false;
    });

    if (!order) {
      return res.status(404).json({
        error:
          "Order not found. Please check your Mobile Number and Order ID."
      });
    }

    const shipmentId = String(
      order.shiprocketShipmentId || ""
    ).trim();

    const awb = String(
      order.awb || ""
    ).trim();

    /*
      Shipment has not been created yet.
    */

    if (!shipmentId && !awb) {

      return res.status(200).json({
        ok: true,
        trackingAvailable: false,

        message:
          "Tracking will be available after your order is shipped.",

        order: {
          id:
            order.id,

          status:
            order.status ||
            "Order Confirmed"
        }
      });
    }

    const email =
      process.env.SHIPROCKET_EMAIL;

    const password =
      process.env.SHIPROCKET_PASSWORD;

    if (!email || !password) {

      return res.status(500).json({
        error:
          "Shiprocket credentials are not configured in Vercel"
      });
    }

    /*
      Login to Shiprocket
    */

    const loginResponse =
      await fetch(
        "https://apiv2.shiprocket.in/v1/external/auth/login",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            email:
              email,

            password:
              password
          })
        }
      );

    const loginData =
      await loginResponse.json();

    if (
      !loginResponse.ok ||
      !loginData.token
    ) {

      return res.status(500).json({
        error:
          "Unable to connect to Shiprocket"
      });
    }

    let trackingUrl = "";

    /*
      Prefer Shipment ID.
    */

    if (shipmentId) {

      trackingUrl =
        "https://apiv2.shiprocket.in/v1/external/courier/track/shipment/" +
        encodeURIComponent(
          shipmentId
        );

    } else {

      trackingUrl =
        "https://apiv2.shiprocket.in/v1/external/courier/track/awb/" +
        encodeURIComponent(
          awb
        );

    }

    /*
      Get live tracking
    */

    const trackingResponse =
      await fetch(
        trackingUrl,
        {
          method: "GET",

          headers: {
            Authorization:
              `Bearer ${loginData.token}`,

            "Content-Type":
              "application/json"
          }
        }
      );

    const trackingText =
      await trackingResponse.text();

    let trackingData = {};

    try {
      trackingData =
        JSON.parse(
          trackingText
        );
    } catch (error) {

      return res.status(500).json({
        error:
          "Invalid tracking response from Shiprocket"
      });
    }

    if (!trackingResponse.ok) {

      return res.status(
        trackingResponse.status
      ).json({
        error:
          trackingData.message ||
          trackingData.error ||
          "Unable to load tracking"
      });
    }

    return res.status(200).json({

      ok: true,

      trackingAvailable:
        true,

      order: {

        id:
          order.id,

        status:
          order.status ||
          "Order Confirmed",

        shiprocketOrderId:
          order.shiprocketOrderId ||
          "",

        shipmentId:
          shipmentId,

        awb:
          awb,

        courier:
          order.courier ||
          ""
      },

      tracking:
        trackingData

    });

  } catch (error) {

    console.error(
      "Customer tracking error:",
      error
    );

    return res.status(500).json({
      error:
        error.message ||
        "Unable to load tracking"
    });
  }
};
