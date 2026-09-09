const { getStore } = require('@netlify/blobs');
function store(){ return getStore({name:'sniper-store', consistency:'strong'}); }
async function getJSON(key, fallback){ const v=await store().get(key,{type:'json'}); return v ?? fallback; }
async function putJSON(key,value){ await store().setJSON(key,value); }
module.exports={store,getJSON,putJSON};
