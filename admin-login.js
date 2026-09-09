exports.handler=async e=>{
 if(e.httpMethod!=='POST') return {statusCode:405,body:'Method not allowed'};
 const {password}=JSON.parse(e.body||'{}');
 if(!process.env.ADMIN_PASSWORD) return {statusCode:500,body:JSON.stringify({error:'ADMIN_PASSWORD is not configured in Netlify'})};
 if(password!==process.env.ADMIN_PASSWORD) return {statusCode:401,body:JSON.stringify({error:'Wrong password'})};
 return {statusCode:200,headers:{'Content-Type':'application/json'},body:JSON.stringify({ok:true})};
};
