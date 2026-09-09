const {getJSON,putJSON}=require('./_store');
const json=(b,s=200)=>({statusCode:s,headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});
function auth(e){return !!process.env.ADMIN_PASSWORD&&e.headers.authorization===`Bearer ${process.env.ADMIN_PASSWORD}`}
exports.handler=async e=>{
 try{
  if(!auth(e)) return json({error:'Unauthorized'},401);
  const {orderId}=JSON.parse(e.body||'{}'); const orders=await getJSON('orders',[]); const o=orders.find(x=>x.id===orderId); if(!o)return json({error:'Order not found'},404);
  if(!process.env.SHIPROCKET_EMAIL||!process.env.SHIPROCKET_PASSWORD)return json({error:'Shiprocket credentials are not configured in Netlify'} ,400);
  const login=await fetch('https://apiv2.shiprocket.in/v1/external/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:process.env.SHIPROCKET_EMAIL,password:process.env.SHIPROCKET_PASSWORD})});
  const ld=await login.json(); if(!login.ok)return json({error:ld.message||'Shiprocket login failed'},502);
  const c=o.customer||{}; const items=(o.items||[]).map(i=>({name:i.name||'Product',sku:String(i.id||'SPW'),units:Number(i.qty||1),selling_price:Number(i.price||0),discount:0,tax:0,hsn:''}));
  const payload={order_id:String(o.receipt||o.id).slice(0,50),order_date:o.createdAt||new Date().toISOString(),pickup_location:process.env.SHIPROCKET_PICKUP_LOCATION||'Primary',billing_customer_name:c.name||'Customer',billing_last_name:'',billing_address:o.address||'',billing_city:process.env.SHIPROCKET_DEFAULT_CITY||'Agra',billing_pincode:o.pin||'',billing_state:process.env.SHIPROCKET_DEFAULT_STATE||'Uttar Pradesh',billing_country:'India',billing_email:c.email||'customer@example.com',billing_phone:c.mobile||'',shipping_is_billing:1,order_items:items,payment_method:o.status==='Paid'?'Prepaid':'COD',sub_total:Number(o.amount||0),length:10,breadth:10,height:5,weight:0.5};
  const cr=await fetch('https://apiv2.shiprocket.in/v1/external/orders/create/adhoc',{method:'POST',headers:{Authorization:`Bearer ${ld.token}`,'Content-Type':'application/json'},body:JSON.stringify(payload)}); const cd=await cr.json(); if(!cr.ok)return json({error:cd.message||'Shiprocket order creation failed',details:cd},502);
  const out=orders.map(x=>x.id===orderId?{...x,shiprocketOrderId:cd.order_id,shiprocketShipmentId:cd.shipment_id,status:x.status==='Paid'?'Ready to Ship':x.status,updatedAt:new Date().toISOString()}:x); await putJSON('orders',out); return json({ok:true,data:cd});
 }catch(err){return json({error:err.message||'Server error'},500)}
};
