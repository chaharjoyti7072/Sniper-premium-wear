JOYTI - SNIPER PREMIUM WEAR: ADMIN + RAZORPAY + SHIPROCKET READY

1) Deploy this whole folder/ZIP to the SAME Netlify site.
2) Netlify -> Site configuration -> Environment variables. Add:
   RAZORPAY_KEY_ID = your Razorpay Key ID
   RAZORPAY_KEY_SECRET = your Razorpay Key Secret
   ADMIN_PASSWORD = a strong private admin password
   SHIPROCKET_EMAIL = Shiprocket API user email
   SHIPROCKET_PASSWORD = Shiprocket API user password
   SHIPROCKET_PICKUP_LOCATION = your Shiprocket pickup location name (optional; default Primary)
   SHIPROCKET_DEFAULT_CITY = Agra (optional)
   SHIPROCKET_DEFAULT_STATE = Uttar Pradesh (optional)
3) Redeploy after adding variables.
4) Customer site: https://YOUR-DOMAIN/
5) Admin panel: https://YOUR-DOMAIN/admin.html
6) Admin can add/edit/delete products and manage order status.
7) Paid Razorpay orders are stored in Netlify Blobs automatically.
8) Shiprocket button creates an adhoc order. Before live shipping, set correct pickup location, city/state and verify package weight/dimensions in Shiprocket.
9) NEVER put Razorpay secret or Shiprocket password in index.html. Only Netlify environment variables.
10) The included COD button is not enabled as an automatic order-storage flow; use Online Payment for the live payment flow.
