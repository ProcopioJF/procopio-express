export type Role = 'admin'|'company'|'courier';
export type Status = 'recorded';
export type User = {id:string; name:string; email:string; role:Role; companyId?:string};
export type Zone = {id:string; name:string; price:number};
export type Address = {cep:string; rua:string; numero:string; bairro:string; complemento?:string; cidade:string; estado:string; coordinates?:{latitude:number;longitude:number}};
export type Order = {id:string; publicId:string; token:string; from?:string; to?:string; pickupAddress?:Address; deliveryAddress?:Address; recipient:string; phone:string; packageInfo:string; zone:string; price:number|null; pricingType?:'FIXED'|'RANGE'|'PER_KM'|'QUOTE'; minimumPrice?:number|null; maximumPrice?:number|null; status:Status; createdAt:string; companyId?:string; courier?:string};
const key='proco-express-db'; type DB={users:User[];zones:Zone[];orders:Order[]};
const initial:DB={users:[{id:'u1',name:'Admin Procópio',email:'admin@procopio.com',role:'admin'},{id:'u2',name:'Acme Logística',email:'empresa@acme.com',role:'company',companyId:'c1'},{id:'u3',name:'João Entregador',email:'joao@procopio.com',role:'courier'}],zones:[{id:'z1',name:'Centro',price:14.9},{id:'z2',name:'Zona Norte',price:19.9},{id:'z3',name:'Zona Sul',price:24.9}],orders:[]};
function read():DB { const raw=localStorage.getItem(key); if(!raw){localStorage.setItem(key,JSON.stringify(initial));return initial} const db=JSON.parse(raw); return {...db,orders:(db.orders||[]).map((o:Order)=>({...o,price:typeof o.price==='number'?o.price:null,pickupAddress:o.pickupAddress||legacyAddress(o.from||''),deliveryAddress:o.deliveryAddress||legacyAddress(o.to||'')}))} }
function legacyAddress(value:string):Address { const [rua='',numero='',bairro=''] = value.split(',').map(v=>v.trim()); return {cep:'',rua,numero,bairro,cidade:'',estado:''}; }
function write(db:DB){localStorage.setItem(key,JSON.stringify(db))}
export const repo={users:{all:()=>read().users},zones:{all:()=>read().zones,save:(zones:Zone[])=>{const db=read();db.zones=zones;write(db)}},orders:{all:()=>read().orders,create:(input:Omit<Order,'id'|'publicId'|'token'|'createdAt'|'status'>)=>{const db=read(); const order:Order={...input,id:crypto.randomUUID(),publicId:`PX-${Date.now().toString(36).toUpperCase()}`,token:crypto.randomUUID().slice(0,8),createdAt:new Date().toISOString(),status:'recorded'};db.orders.unshift(order);write(db);return order;},update:(id:string,patch:Partial<Order>)=>{const db=read();db.orders=db.orders.map(o=>o.id===id?{...o,...patch}:o);write(db)},findPublic:(value:string)=>read().orders.find(o=>o.publicId.toLowerCase()===value.toLowerCase()||o.token.toLowerCase()===value.toLowerCase())}};
export const auth={get:():User|null=>{const raw=localStorage.getItem('px-auth-user'); if(raw){try{return JSON.parse(raw) as User}catch{localStorage.removeItem('px-auth-user')}} const id=localStorage.getItem('px-user'); return id?repo.users.all().find(u=>u.id===id)||null:null},set:(user:User,token:string)=>{localStorage.setItem('px-auth-user',JSON.stringify(user));localStorage.setItem('px-auth-token',token);localStorage.removeItem('px-user')},token:()=>localStorage.getItem('px-auth-token'),logout:()=>{localStorage.removeItem('px-auth-user');localStorage.removeItem('px-auth-token');localStorage.removeItem('px-user')}};
const whatsappNumber = (import.meta.env.VITE_WHATSAPP_NUMBER ?? '5532999999999').replace(/\D/g, '');
export const wa=(o:Order)=> {
  const pickup = o.pickupAddress ? `${o.pickupAddress.rua}, ${o.pickupAddress.numero} - ${o.pickupAddress.bairro}` : o.from;
  const delivery = o.deliveryAddress ? `${o.deliveryAddress.rua}, ${o.deliveryAddress.numero} - ${o.deliveryAddress.bairro}` : o.to;
  const price = o.price === null ? 'Consultar valor' : `R$ ${o.price.toFixed(2).replace('.', ',')}`;
  const message = [
    '🚨 NOVO PEDIDO — PROCÓPIO EXPRESS',
    '',
    `Nome: ${o.recipient}`,
    `Telefone: ${o.phone}`,
    '',
    '📍 COLETA:',
    pickup,
    '',
    '📦 ENTREGA:',
    delivery,
    '',
    `📦 O QUE SERÁ TRANSPORTADO: ${o.packageInfo}`,
    `💰 VALOR DA ENTREGA: ${price}`,
  ].join('\n');
  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
};
