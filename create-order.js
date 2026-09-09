const {putJSON,getJSON}=require('./_store');
exports.handler=async (event)=>{
 try{
  if(event.httpMethod!=='POST') return {statusCode:405,body:JSON.stringify({error:'Method not allowed'})};
  const {amount,receipt,customer,items,address,pin}=JSON.parse(event.body||'{}');
  if(!amount||amount<100) return {statusCode:400,body:JSON.stringify({error:'Invalid amount'})};
  const key=process.env.RAZORPAY_KEY_ID, secret=process.env.RAZORPAY_KEY_SECRET;
  if(!key||!secret) return {statusCode:500,body:JSON.stringify({error:'Razorpay keys are not configured in Netlify'})};
  const auth=Buffer.from(`${key}:${secret}`).toString('base64');
  const r=await fetch('https://api.razorpay.com/v1/orders',{method:'POST',headers:{Authorization:`Basic ${auth}`,'Content-Type':'application/json'},body:JSON.stringify({amount,currency:'INR',receipt:receipt||`SPW-${Date.now()}`,payment_capture:1})});
  const data=await r.json(); if(!r.ok) return {statusCode:r.status,body:JSON.stringify({error:data.error?.description||'Razorpay order failed'})};
  const orders=await getJSON('orders',[]);
  orders.push({id:data.id,razorpayOrderId:data.id,receipt:data.receipt,amount:data.amount/100,currency:data.currency,customer:customer||{},items:items||[],address:address||'',pin:pin||'',status:'Payment Pending',createdAt:new Date().toISOString()});
  await putJSON('orders',orders);
  return {statusCode:200,headers:{'Content-Type':'application/json'},body:JSON.stringify({id:data.id,amount:data.amount,currency:data.currency,key_id:key})};
 }catch(err){return {statusCode:500,body:JSON.stringify({error:err.message||'Server error'})}}
};
