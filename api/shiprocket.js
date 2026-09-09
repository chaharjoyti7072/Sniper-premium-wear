const BASE_URL = "https://apiv2.shiprocket.in/v1/external";

async function getShiprocketToken() {
  const email = process.env.SHIPROCKET_EMAIL;
  const password = process.env.SHIPROCKET_PASSWORD;

  if (!email || !password) {
    throw new Error("Shiprocket credentials are missing");
  }

  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email,
      password
    })
  });

  const data = await response.json();

  if (!response.ok || !data.token) {
    throw new Error(
      data.message || "Shiprocket authentication failed"
    );
  }

  return data.token;
}

async function createShiprocketOrder(order) {
  const token = await getShiprocketToken();

  const payload = {
    order_id: String(order.order_id),
    order_date: new Date().toISOString().slice(0, 19).replace("T", " "),

    pickup_location: "Jyoti",

    billing_customer_name: order.name,
    billing_last_name: "",
    billing_address: order.address,
    billing_address_2: "",
    billing_city: "Agra",
    billing_pincode: String(order.pin),
    billing_state: "Uttar Pradesh",
    billing_country: "India",
    billing_email: order.email || "",
    billing_phone: String(order.mobile),

    shipping_is_billing: true,

    order_items: order.items.map(item => ({
      name: item.name,
      sku: String(item.id),
      units: Number(item.qty),
      selling_price: Number(item.price)
    })),

    payment_method: order.payment === "COD" ? "COD" : "Prepaid",

    sub_total: Number(order.total),

    length: 12,
    breadth: 15,
    height: 10,
    weight: 0.5
  };

  const response = await fetch(`${BASE_URL}/orders/create/adhoc`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Shiprocket order creation failed"
    );
  }

  return data;
}

module.exports = {
  getShiprocketToken,
  createShiprocketOrder
};
