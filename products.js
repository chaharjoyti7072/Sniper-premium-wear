const {getJSON,putJSON}=require('./_store');
const DEFAULT=[
{id:1,name:'Premium T-Shirt',price:699,img:'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=80',description:'Premium quality'},
{id:2,name:'Premium Trousers',price:999,img:'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80',description:'Premium quality'},
{id:3,name:'Premium Shorts',price:599,img:'https://images.unsplash.com/photo-1562157873-818bc0726f68?auto=format&fit=crop&w=900&q=80',description:'Premium quality'},
{id:4,name:'Premium Footwear',price:1499,img:'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80',description:'Premium quality'}
];
function ok(body,status=200){return {status,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}}
function auth(e){return !!process.env.ADMIN_PASSWORD && e.headers.authorization===`Bearer ${process.env.ADMIN_PASSWORD}`}
exports.handler=async e=>{
 try{
  const method=e.httpMethod;
  if(method==='GET') return ok({products:await getJSON('products',DEFAULT)});
  if(!auth(e)) return ok({error:'Unauthorized'},401);
  if(method==='POST'||method==='PUT'){
   const body=JSON.parse(e.body||'{}');
   if(!body.name||!Number.isFinite(Number(body.price))) return ok({error:'Name and valid price are required'},400);
   const list=await getJSON('products',DEFAULT);
   const p={id:Number(body.id)||Date.now(),name:String(body.name).trim(),price:Math.round(Number(body.price)),img:String(body.img||'').trim(),description:String(body.description||'Premium quality').trim()};
   const out=method==='PUT'?list.map(x=>x.id===p.id?p:x):[...list,p]; await putJSON('products',out); return ok({products:out});
  }
  if(method==='DELETE'){
   const id=Number(new URL(e.rawUrl).searchParams.get('id')); const list=await getJSON('products',DEFAULT); const out=list.filter(x=>x.id!==id); await putJSON('products',out); return ok({products:out});
  }
  return ok({error:'Method not allowed'},405);
 }catch(err){return ok({error:err.message||'Server error'},500)}
};
