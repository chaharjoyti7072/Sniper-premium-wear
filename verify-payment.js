const crypto=require('crypto'); const {getJSON,putJSON}=require('./_store');
exports.handler=async event=>{
 try{
  if(event.httpMethod!=='POST') return {statusCode:405,body:JSON.stringify({error:'Method not allowed'})};
  const {razorpay_order_id,razorpay_payment_id,razorpay_signature}=JSON.parse(event.body||'{}');
  const secret=process.env.RAZORPAY_KEY_SECRET;
  if(!secret) return {statusCode:500,body:JSON.stringify({error:'Razorpay secret is not configured'})};
  const expected=crypto.createHmac('sha256',secret).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');
  const verified=crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(String(razorpay_signature||'')));
  if(!verified) return {statusCode:400,body:JSON.stringify({verified:false,error:'Invalid payment signature'})};
  const orders=await getJSON('orders',[]); const out=orders.map(o=>o.razorpayOrderId===razorpay_order_id?{...o,status:'Paid',paymentId:razorpay_payment_id,updatedAt:new Date().toISOString()}:o); await putJSON('orders',out);
  return {statusCode:200,headers:{'Content-Type':'application/json'},body:JSON.stringify({verified:true})};
 }catch(err){return {statusCode:500,body:JSON.stringify({error:err.message||'Server error'})}}
};
