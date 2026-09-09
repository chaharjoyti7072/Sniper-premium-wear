const {getJSON,putJSON}=require('./_store');
function ok(body,status=200){return {status,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}}
function auth(e){return !!process.env.ADMIN_PASSWORD && e.headers.authorization===`Bearer ${process.env.ADMIN_PASSWORD}`}
exports.handler=async e=>{
 try{
  if(!auth(e)) return ok({error:'Unauthorized'},401);
  const orders=await getJSON('orders',[]);
  if(e.httpMethod==='GET') return ok({orders:orders.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt))});
  if(e.httpMethod==='PATCH'){
   const body=JSON.parse(e.body||'{}');
   const out=orders.map(o=>o.id===body.id?{...o,status:String(body.status||o.status),updatedAt:new Date().toISOString()}:o);
   await putJSON('orders',out); return ok({orders:out});
  }
  return ok({error:'Method not allowed'},405);
 }catch(err){return ok({error:err.message||'Server error'},500)}
};
