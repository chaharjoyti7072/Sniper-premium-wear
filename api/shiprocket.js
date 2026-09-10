const BASE_URL =
  "https://apiv2.shiprocket.in/v1/external";


// --------------------------------------------------
// SHIPROCKET LOGIN
// --------------------------------------------------

async function getShiprocketToken() {

  const email =
    process.env.SHIPROCKET_EMAIL;

  const password =
    process.env.SHIPROCKET_PASSWORD;


  if (!email || !password) {
    throw new Error(
      "Shiprocket credentials are missing"
    );
  }


  const response = await fetch(
    `${BASE_URL}/auth/login`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        email,
        password
      })
    }
  );


  const text =
    await response.text();


  let data = {};

  try {
    data = JSON.parse(text);
  } catch (error) {
    data = {
      raw: text
    };
  }


  if (
    !response.ok ||
    !data.token
  ) {

    throw new Error(
      data.message ||
      data.error ||
      "Shiprocket authentication failed"
    );

  }


  return data.token;
}


// --------------------------------------------------
// FIND VALUE RECURSIVELY
// --------------------------------------------------

function findValue(
  object,
  wantedKeys
) {

  if (
    object === null ||
    object === undefined
  ) {
    return "";
  }


  if (
    typeof object !== "object"
  ) {
    return "";
  }


  for (
    const key of wantedKeys
  ) {

    if (
      Object.prototype.hasOwnProperty.call(
        object,
        key
      )
    ) {

      const value =
        object[key];

      if (
        value !== null &&
        value !== undefined &&
        String(value) !== ""
      ) {

        return String(value);

      }

    }

  }


  for (
    const key of Object.keys(object)
  ) {

    const value =
      object[key];


    if (
      value &&
      typeof value === "object"
    ) {

      const found =
        findValue(
          value,
          wantedKeys
        );


      if (found) {
        return found;
      }

    }

  }


  return "";
}


// --------------------------------------------------
// CREATE SHIPROCKET ORDER
// --------------------------------------------------

async function createShiprocketOrder(
  order
) {

  const token =
    await getShiprocketToken();


  const payload = {

    order_id:
      String(order.order_id),


    order_date:
      new Date()
        .toISOString()
        .slice(0, 19)
        .replace("T", " "),


    pickup_location:
      "Joyti",


    billing_customer_name:
      String(order.name || ""),


    billing_last_name:
      "",


    billing_address:
      String(order.address || ""),


    billing_address_2:
      "",


    billing_city:
      "Agra",


    billing_pincode:
      String(order.pin || ""),


    billing_state:
      "Uttar Pradesh",


    billing_country:
      "India",


    billing_email:
      String(order.email || ""),


    billing_phone:
      String(order.mobile || ""),


    shipping_is_billing:
      true,


    order_items:
      Array.isArray(order.items)
        ? order.items.map(
            (item, index) => ({

              name:
                String(
                  item.name ||
                  "Product"
                ),

              sku:
                String(
                  item.id ||
                  `${order.order_id}-${index + 1}`
                ),

              units:
                Number(
                  item.qty || 1
                ),

              selling_price:
                Number(
                  item.price || 0
                )

            })
          )
        : [],


    payment_method:
      order.payment === "COD"
        ? "COD"
        : "Prepaid",


    sub_total:
      Number(order.total || 0),


    length:
      12,


    breadth:
      15,


    height:
      10,


    weight:
      0.5

  };


  console.log(
    "SHIPROCKET REQUEST:",
    JSON.stringify(payload)
  );


  const response =
    await fetch(
      `${BASE_URL}/orders/create/adhoc`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          "Authorization":
            `Bearer ${token}`
        },

        body:
          JSON.stringify(payload)
      }
    );


  // IMPORTANT:
  // Read raw response first
  const text =
    await response.text();


  let data = {};

  try {

    data =
      JSON.parse(text);

  } catch (error) {

    data = {
      raw: text
    };

  }


  console.log(
    "SHIPROCKET RESPONSE:",
    JSON.stringify(data)
  );


  // ------------------------------------------------
  // SHIPROCKET API ERROR
  // ------------------------------------------------

  if (!response.ok) {

    const message =
      data.message ||
      data.error ||
      data.error_message ||
      data.raw ||
      "Shiprocket order creation failed";


    throw new Error(
      String(message)
    );

  }


  // ------------------------------------------------
  // GET ORDER ID
  // ------------------------------------------------

  const shiprocketOrderId =
    findValue(
      data,
      [
        "order_id",
        "orderId"
      ]
    );


  // ------------------------------------------------
  // GET SHIPMENT ID
  // ------------------------------------------------

  const shipmentId =
    findValue(
      data,
      [
        "shipment_id",
        "shipmentId"
      ]
    );


  console.log(
    "SHIPROCKET ORDER ID:",
    shiprocketOrderId
  );


  console.log(
    "SHIPROCKET SHIPMENT ID:",
    shipmentId
  );


  // ------------------------------------------------
  // RETURN NORMALIZED RESPONSE
  // ------------------------------------------------

  return {

    order_id:
      shiprocketOrderId,


    shipment_id:
      shipmentId,


    raw:
      data

  };

}


module.exports = {

  getShiprocketToken,

  createShiprocketOrder

};
