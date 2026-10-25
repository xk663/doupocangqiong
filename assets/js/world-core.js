(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./world-navigation.js'));else root.WorldCore=factory(root.WorldNavigation);})(typeof globalThis!=='undefined'?globalThis:this,function(Nav){
 'use strict';
 const clone=x=>JSON.parse(JSON.stringify(x));
 const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const unique=a=>[...new Set(a)];
 function hash(text){let h=2166136261;for(const c of String(text)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
 function rank(realm){const names=['斗之气','斗者','斗师','大斗师','斗灵','斗王','斗皇','斗宗','斗尊','半圣','斗圣','斗帝'];for(let i=names.length-1;i>=0;i--)if(String(realm).includes(names[i]))return i;return 0;}
 function node(data,id){return data.nodes.find(n=>n.id===id);}
 function rootOf(data,id){const n=node(data,id);return n?.root||n?.id;}
 function inferLocation(data,player,world){
  const text=(world?.location||'')+' '+(world?.specificSpot||'')+' '+(player.location||'');
  const match=data.nodes.slice().sort((a,b)=>b.name.length-a.name.length).find(n=>text.includes(n.name));
  return match?.id||(['wutan','qingshan','shimo'].includes(player.startLocation)?player.startLocation:'wutan');
 }
 function initial(data,id='wutan',seed='journey',gender='male'){
  if(!node(data,id))id='wutan';
  const publicIds=['wutan','qingshan','shimo','blackrock','capital','mo-city','tager','blackcorner','peace','outer','tianya','zhongzhou','holy-pill','beast-region','ancient-city'];
  const root=rootOf(data,id);
  const known=publicIds.concat(data.nodes.filter(n=>!n.secret&&(n.root===root||n.id===root)).map(n=>n.id));
  const state={version:1,avatarId:Nav.avatar(gender).id,movementMode:'walk',caravanCredit:0,seed:String(seed).slice(0,80),locationId:id,scene:['wutan','qingshan','shimo'].includes(root)?root:'world',discovered:unique(known.concat(id)),visited:[id],visitCounts:{[id]:1},explored:{},vigor:100,minutes:0,turn:0,trust:Object.fromEntries(data.npcs.map(n=>[n.id,0])),quests:[],journal:[],flags:{}};state.pose=Nav.position(data,state);return state;
 }
 function normalize(data,s,player={},world={}){
  if(!s){const created=initial(data,inferLocation(data,player,world),player.name||'journey');created.avatarId=Nav.avatar(player.gender).id;created.movementMode='walk';return created;}
  if(s.version!==1)throw Error('地图存档版本不受支持，请先导出原存档');
  const allowed=new Set(data.nodes.map(n=>n.id));const base=initial(data,allowed.has(s.locationId)?s.locationId:inferLocation(data,player,world),s.seed||player.name,player.gender);
  base.scene=data.scenes.some(x=>x.id===s.scene)?s.scene:'world';
  base.discovered=unique((Array.isArray(s.discovered)?s.discovered:base.discovered).filter(id=>allowed.has(id)).concat(base.locationId));
  base.visited=unique((Array.isArray(s.visited)?s.visited:[]).filter(id=>allowed.has(id)).concat(base.locationId));
  for(const key of ['visitCounts','explored'])for(const id of allowed)if(Number.isFinite(Number(s[key]?.[id])))base[key][id]=clamp(Math.floor(Number(s[key][id])),0,1000000);
  base.vigor=clamp(finite(s.vigor,100),0,100);base.minutes=clamp(Math.floor(finite(s.minutes)),0,1e9);base.turn=clamp(Math.floor(finite(s.turn)),0,1e7);
  for(const npc of data.npcs)base.trust[npc.id]=clamp(finite(s.trust?.[npc.id]),0,100);
  base.quests=(Array.isArray(s.quests)?s.quests:[]).filter(q=>q&&typeof q.id==='string'&&data.npcs.some(n=>q.id==='map-'+n.id)).slice(0,20).map(q=>({id:q.id,npcId:q.npcId,kind:['herbs','road'].includes(q.kind)?q.kind:'road',target:allowed.has(q.target)?q.target:'qingshan',status:['active','completed'].includes(q.status)?q.status:'active',name:String(q.name||'地方委托').slice(0,60)}));
  base.journal=(Array.isArray(s.journal)?s.journal:[]).slice(-60).filter(e=>e&&typeof e.text==='string').map(e=>({id:String(e.id||'record').slice(0,90),type:String(e.type||'event').slice(0,20),text:e.text.slice(0,400),at:clamp(finite(e.at),0,1e9)}));
  for(const [key,value] of Object.entries(s.flags||{}))if(/^[a-z0-9-]{1,100}$/.test(key)&&typeof value==='boolean')base.flags[key]=value;
  base.caravanCredit=clamp(finite(s.caravanCredit),0,25);base.avatarId=Nav.avatar(player.gender,s.avatarId).id;base.movementMode=['walk','convoy','flight'].includes(s.movementMode)?s.movementMode:'walk';if(base.movementMode==='flight'&&rank(player.realm)<5)base.movementMode='walk';
  const pose=s.pose;if(pose&&[pose.x,pose.y].every(Number.isFinite)&&pose.sceneId===base.pose.sceneId&&pose.x>=0&&pose.x<=100&&pose.y>=0&&pose.y<=100){const segments=Nav.geometry(data,pose.sceneId);if(pose.airborne&&rank(player.realm)>=5||!segments||Nav.nearest(segments,pose).distance<=7){base.pose={sceneId:pose.sceneId,x:pose.x,y:pose.y,direction:[0,1,2,3].includes(pose.direction)?pose.direction:0};if(pose.airborne&&rank(player.realm)>=5)base.pose.airborne=true;}}
  return base;
 }
 function inventoryCount(ctx,name){return (ctx.player.inventory||[]).filter(i=>i.name===name).reduce((sum,i)=>sum+Math.max(0,finite(i.qty)),0);}
 function addItem(ctx,name,qty,icon='物'){
  const list=ctx.player.inventory||(ctx.player.inventory=[]);const item=list.find(i=>i.name===name&&!i.usable);
  if(item)item.qty=Math.max(0,finite(item.qty))+qty;else list.push({id:'map-item-'+hash(name),name,qty,icon,desc:'探索与行旅获得的物资'});
 }
 function removeItem(ctx,name,count){
  if(inventoryCount(ctx,name)<count)throw Error(name+'不足');
  for(const item of ctx.player.inventory||[]){if(item.name!==name)continue;const take=Math.min(count,Math.max(0,finite(item.qty)));item.qty-=take;count-=take;if(!count)break;}
  ctx.player.inventory=ctx.player.inventory.filter(i=>finite(i.qty)>0);
 }
 function log(s,type,text){s.turn++;s.journal.push({id:s.seed+'-'+s.turn,type,text,at:s.minutes});s.journal=s.journal.slice(-60);}
 function discover(s,id){if(id&&!s.discovered.includes(id))s.discovered.push(id);}
 function advance(ctx,hours){
  const minutes=Math.round(hours*60);ctx.state.minutes+=minutes;
  const t=ctx.gameTime;t.minute=Math.floor(finite(t.minute))+minutes;t.hour=Math.floor(finite(t.hour))+Math.floor(t.minute/60);t.minute%=60;
  t.day=Math.max(1,Math.floor(finite(t.day,1)))+Math.floor(t.hour/24);t.hour%=24;
  t.month=Math.max(1,Math.floor(finite(t.month,1)))+Math.floor((t.day-1)/30);t.day=(t.day-1)%30+1;
  t.year=Math.max(1,Math.floor(finite(t.year,1)))+Math.floor((t.month-1)/12);t.month=(t.month-1)%12+1;t.totalHours=finite(t.totalHours)+hours;
 }
 function gate(data,s,id,player){const n=node(data,id);if(!n)return '地点不存在';if(!s.discovered.includes(id))return '尚未获得地点线索';if(n.lateOnly)return '属于终局之后的时间层，当前未开放';if(rank(player.realm)<(n.minRank||0))return '该入口需要更高境界与进入条件';return '';}
 function path(data,s,from,to,player){
  if(!node(data,from)||!node(data,to))return null;
  const cost=new Map([[from,0]]),prev=new Map(),open=new Set([from]);
  while(open.size){const cur=[...open].sort((a,b)=>cost.get(a)-cost.get(b))[0];open.delete(cur);if(cur===to)break;
   for(const e of data.edges){const next=e.a===cur?e.b:e.b===cur?e.a:null;if(!next||gate(data,s,next,player))continue;const val=cost.get(cur)+e.hours;if(val<(cost.get(next)??Infinity)){cost.set(next,val);prev.set(next,{id:cur,edge:e});open.add(next);}}
  }
  if(!cost.has(to))return null;const edges=[],ids=[to];let cur=to;while(cur!==from){const p=prev.get(cur);if(!p)return null;edges.unshift(p.edge);ids.unshift(p.id);cur=p.id;}
  return {edges,ids};
 }
 function plan(data,ctx,to,mode='walk'){
  const s=ctx.state,reason=gate(data,s,to,ctx.player);if(reason)return {ok:false,reason};
  if(!['walk','convoy','flight'].includes(mode))return {ok:false,reason:'未知旅行方式'};
  if(to===s.locationId)return {ok:false,reason:'你已在此地'};
  if(mode==='flight'&&rank(ctx.player.realm)<5)return {ok:false,reason:'斗王之前需另有已验证的飞行斗技；当前不能选择化翼飞行'};
  const found=path(data,s,s.locationId,to,ctx.player);if(!found)return {ok:false,reason:'尚无已知可通行路线；先寻找入口线索'};
  const baseHours=found.edges.reduce((n,e)=>n+e.hours,0);
  const hours=Math.round(found.edges.reduce((n,e)=>n+e.hours*(e.kind==='wormhole'||e.kind==='portal'?1:mode==='flight'?.3:mode==='convoy'?.8:1),0)*60)/60;
  const gold=found.edges.reduce((n,e)=>n+e.gold,0)+(mode==='convoy'?Math.ceil(baseHours/12)*3:0);
  const food=hours>8?Math.ceil(hours/18):0,water=hours>8?Math.ceil(hours/14):0,energy=Math.min(80,Math.ceil(hours*(mode==='convoy'?.7:1.5)));
  const problems=[];if(finite(ctx.economy.gold)<gold)problems.push('金币不足');if(inventoryCount(ctx,'干粮')<food)problems.push('干粮不足');if(inventoryCount(ctx,'水囊')<water)problems.push('水囊不足');if(s.vigor<energy)problems.push('行旅精力不足，先休整');
  return {ok:!problems.length,reason:problems.join('；'),to,mode,ids:found.ids,edges:found.edges.map(e=>e.id),hours,gold,food,water,energy};
 }
 function walkPlan(data,ctx,sceneId,target,mode='walk'){
  const pose=Nav.position(data,ctx.state);if(sceneId!==pose.sceneId||sceneId==='world')return {ok:false,reason:'请先进入角色当前所在的地区'};
  if(!Object.hasOwn(Nav.forms,mode))return {ok:false,reason:'未知移动方式'};if(mode==='flight'&&rank(ctx.player.realm)<5)return {ok:false,reason:'化翼飞行需要斗王境界，选择形象不会解锁飞行'};
  let trip;if(mode==='flight'){if(![target.x,target.y].every(Number.isFinite)||target.x<2||target.x>98||target.y<2||target.y>98)return {ok:false,reason:'请在地图有效范围内选择落点'};trip={ok:true,points:[pose,{x:target.x,y:target.y}],target:{x:target.x,y:target.y},length:Nav.distance(pose,target)};}else trip=Nav.route(data,sceneId,pose,target);
  if(!trip.ok)return trip;if(trip.length<.15)return {ok:false,reason:'已经到达这里'};
  const hours=Math.max(1,Math.ceil(trip.length/(mode==='flight'?20:mode==='convoy'?10:8)))/60,energy=Math.round(trip.length*(mode==='flight'?.045:mode==='convoy'?.05:.08)*10)/10,gold=mode==='convoy'?Math.ceil(Math.max(0,trip.length-(ctx.state.caravanCredit||0))/25):0;const rideRemaining=mode==='convoy'?(ctx.state.caravanCredit||0)+gold*25-trip.length:(ctx.state.caravanCredit||0);
  const ground=mode==='flight'?Nav.geometry(data,sceneId):null,landingReserve=ground?Math.ceil(Nav.nearest(ground,trip.target).distance*.045*10)/10:0;
  if(ctx.state.vigor<energy+landingReserve)return {ok:false,reason:landingReserve?'精力不足以飞到此处并安全返回道路，先休整':'行旅精力不足，先休整'};if(finite(ctx.economy.gold)<gold)return {ok:false,reason:'金币不足，随商队骑乘需要支付费用'};return {...trip,hours,energy,gold,mode,rideRemaining};
 }
 function nearbyNpcs(data,ctx){
  const root=rootOf(data,ctx.state.locationId),day=finite(ctx.gameTime.hour,8)>=6&&finite(ctx.gameTime.hour,8)<20;
  return data.npcs.filter(n=>n.scene===root).map(n=>({...n,locationId:day?n.day:n.night,available:(()=>{const location=node(data,day?n.day:n.night),pose=Nav.position(data,ctx.state);return pose.sceneId===n.scene&&Nav.distance(pose,location)<=5;})()}));
 }
 function currentNpc(data,ctx,id){const npc=nearbyNpcs(data,ctx).find(n=>n.id===id&&n.available);if(!npc)throw Error('先到达人物所在位置，再进行互动');return npc;}
 function syncQuests(ctx){
  const make=q=>({id:q.id,name:q.name,desc:q.kind==='herbs'?'交付3份低阶药材':'到访目的地并回到委托人处交付',reward:q.kind==='herbs'?'12金币':'8金币',difficulty:'地方委托',source:'world-map'});
  const q=ctx.questSystem;
  q.quests=(q.quests||[]).filter(x=>!String(x.id).startsWith('map-')).concat(ctx.state.quests.filter(x=>x.status==='active').map(make));
  q.completed=(q.completed||[]).filter(x=>!String(x.id).startsWith('map-')).concat(ctx.state.quests.filter(x=>x.status==='completed').map(make));
 }
 function transition(data,input,action){
  if(!action||typeof action.type!=='string')throw Error('行动无效');
  const ctx=clone(input);delete ctx.cosmetic;ctx.state=normalize(data,input.state,ctx.player,ctx.worldState);ctx.player.inventory=ctx.player.inventory||[];ctx.economy=ctx.economy||{gold:0};ctx.gameTime=ctx.gameTime||{year:1,month:1,day:1,hour:8,minute:0,totalHours:0};ctx.questSystem=ctx.questSystem||{quests:[],completed:[],failed:[]};
  const s=ctx.state,here=node(data,s.locationId);let message='';
  if(action.type==='appearance'||action.type==='movement-mode'){
   if(action.type==='appearance'){if(!Nav.avatars.some(a=>a.id===action.avatarId))throw Error('未知地图形象');s.avatarId=action.avatarId;message='地图形象已切换为'+Nav.avatar(ctx.player.gender,s.avatarId).name+'。';}
   else{if(!Object.hasOwn(Nav.forms,action.mode))throw Error('未知移动方式');if(action.mode==='flight'&&rank(ctx.player.realm)<5)throw Error('化翼飞行需要斗王境界');if(action.mode!=='flight'&&s.pose.airborne){const segments=Nav.geometry(data,s.pose.sceneId);if(segments&&Nav.nearest(segments,s.pose).distance>7)throw Error('请先飞到道路附近，再降落切换移动方式');delete s.pose.airborne;}s.movementMode=action.mode;message='移动方式：'+Nav.forms[action.mode].name+'。';}
   ctx.player.exploration=s;ctx.cosmetic=true;ctx.message=message;return ctx;
  }
  if(action.type==='travel'){
   const trip=plan(data,ctx,action.targetId,action.mode||'walk');if(!trip.ok)throw Error(trip.reason);
   ctx.economy.gold-=trip.gold;removeItem(ctx,'干粮',trip.food);removeItem(ctx,'水囊',trip.water);s.vigor-=trip.energy;advance(ctx,trip.hours);
   s.locationId=action.targetId;discover(s,s.locationId);s.visited=unique(s.visited.concat(trip.ids));for(const id of trip.ids)s.visitCounts[id]=(s.visitCounts[id]||0)+1;
   s.movementMode=action.mode||'walk';const root=rootOf(data,s.locationId);s.scene=['wutan','qingshan','shimo'].includes(root)?root:'world';s.pose=Nav.position(data,{...s,pose:null});if(s.movementMode==='flight')s.pose.airborne=true;
   for(const n of data.nodes)if(!n.secret&&(n.root===root||n.id===root))discover(s,n.id);
   for(const e of data.edges){const other=e.a===s.locationId?e.b:e.b===s.locationId?e.a:null;if(other&&!node(data,other).secret)discover(s,other);}
   message='沿已知路线抵达'+node(data,s.locationId).name+'，耗时'+trip.hours+'小时。';
   const key='road-'+hash(trip.edges.join('-')+'-'+Math.floor(s.minutes/1440));
   if(trip.hours>=4&&!s.flags[key]){s.flags[key]=true;const choice=hash(s.seed+key)%3;if(choice===0){addItem(ctx,'低阶药材',1,'药');message+=' 在休息处辨认出一份低阶药材。';}else if(choice===1){s.vigor=Math.max(0,s.vigor-3);message+=' 一段泥泞道路额外消耗了3点行旅精力。';}else message+=' 商队传来的路况与地图相符。';}
   log(s,'travel',message);
  }else if(action.type==='walk'){
   const trip=walkPlan(data,ctx,action.sceneId,action,action.mode||'walk');if(!trip.ok)throw Error(trip.reason);
   ctx.economy.gold-=trip.gold;s.movementMode=trip.mode;s.caravanCredit=trip.rideRemaining;s.vigor=Math.max(0,Math.round((s.vigor-trip.energy)*10)/10);advance(ctx,trip.hours);
   s.pose={sceneId:action.sceneId,x:trip.target.x,y:trip.target.y,direction:trip.points.length>1?Nav.direction(trip.points.at(-2),trip.points.at(-1)):0};
   if(trip.mode==='flight')s.pose.airborne=true;
   const arrival=Nav.arrival(data,s,action.sceneId,trip.target);if(arrival&&!gate(data,s,arrival.id,ctx.player)){s.locationId=arrival.id;s.visited=unique(s.visited.concat(arrival.id));s.visitCounts[arrival.id]=(s.visitCounts[arrival.id]||0)+1;}
   s.scene=action.sceneId;message=arrival?(trip.mode==='flight'?'飞抵':trip.mode==='convoy'?'随商队抵达':'步行抵达')+arrival.name+'。':trip.mode==='flight'?'御空飞行，停在当前空域。':'沿街巷与小径行进，停在附近道路。';log(s,'walk',message);
  }else if(action.type==='explore'){
   if(s.vigor<8)throw Error('行旅精力不足，先休整');const last=s.explored[here.id];if(last!==undefined&&s.minutes-last<180)throw Error('这一带刚刚调查过，至少间隔3个游戏小时再探索');
   advance(ctx,2);s.vigor-=8;s.explored[here.id]=s.minutes;
   const first=!s.flags['explored-'+here.id];s.flags['explored-'+here.id]=true;
   if(first&&['wild','mountain-range','cave','desert','ruin'].includes(here.type)){addItem(ctx,'低阶药材',2,'药');message='调查'+here.name+'，记录地形并采得2份低阶药材。';}else message='调查'+here.name+'，记录了周边环境与往来动向。';
   if(['forest-trail','forest-waterfall'].includes(here.id)){discover(s,'forest-grotto');message+=' 溪流旁的痕迹指向一处隐蔽岩隙。';}
   if(first)for(const e of data.edges){const other=e.a===here.id?e.b:e.b===here.id?e.a:null;if(other&&node(data,other).secret&&!node(data,other).lateOnly){discover(s,other);message+=' 获得受限入口的线索，仍需满足进入条件。';}}
   if(['shimo-watch','shimo-oasis'].includes(here.id)){discover(s,'lotus-cave');message+=' 你记录了地底岩浆的传闻，这仍不代表拥有异火。';}
   if(here.id==='forest-grotto'&&first){addItem(ctx,'山路札记',1,'册');message+=' 留下一份山路札记，可在对话中继续调查。';}
   log(s,'explore',message);
  }else if(action.type==='rest'){
   if(s.pose.airborne){const ground=Nav.geometry(data,s.pose.sceneId);if(ground&&Nav.nearest(ground,s.pose).distance>7)throw Error('请先飞到道路附近并落地，再休整');delete s.pose.airborne;s.movementMode='walk';}
   const restingPose=Nav.position(data,s),restingSpot=here.id===restingPose.sceneId?{x:here.localPosition[0],y:here.localPosition[1]}:here;
   const comfortable=['city','town','inn','market','academy'].includes(here.type)&&Nav.distance(restingPose,restingSpot)<=4,price=comfortable?2:0;
   if(finite(ctx.economy.gold)<price)throw Error('金币不足，可在野外扎营或出售物资');ctx.economy.gold-=price;advance(ctx,comfortable?6:8);s.vigor=Math.min(100,s.vigor+(comfortable?65:40));message=comfortable?'在'+here.name+'歇息6小时，支付2金币，恢复65点行旅精力。':'在'+here.name+'扎营8小时，恢复40点行旅精力。';log(s,'rest',message);
  }else if(action.type==='talk'){
   const npc=currentNpc(data,ctx,action.npcId);advance(ctx,.25);s.trust[npc.id]=Math.min(100,(s.trust[npc.id]||0)+1);discover(s,npc.rumor);message=npc.name+'：'+npc.topic;log(s,'talk',message);
  }else if(action.type==='buy'||action.type==='sell'){
   const npc=currentNpc(data,ctx,action.npcId);if(!npc.shop)throw Error('此人不经营物资');const item=data.trade.find(x=>x.id===action.itemId);const qty=Number(action.qty||1);if(!item||!Number.isInteger(qty)||qty<1||qty>10)throw Error('交易数量无效');
   if(action.type==='buy'){const price=item.price*qty;if(finite(ctx.economy.gold)<price)throw Error('金币不足');ctx.economy.gold-=price;addItem(ctx,item.name,qty,item.icon);message='向'+npc.name+'购买'+item.name+'×'+qty+'，支付'+price+'金币。';}
   else{if(!item.sell)throw Error('此物资当前不收购');removeItem(ctx,item.name,qty);ctx.economy.gold+=item.sell*qty;message='出售'+item.name+'×'+qty+'，获得'+item.sell*qty+'金币。';}advance(ctx,.1);log(s,'trade',message);
  }else if(action.type==='accept'){
   const npc=currentNpc(data,ctx,action.npcId),id='map-'+npc.id;if(s.quests.some(q=>q.id===id))throw Error('这项委托已经记录，不能重复领取');
   const target=npc.scene==='wutan'?'qingshan':npc.scene==='qingshan'?'forest-waterfall':'shimo-oasis';
   s.quests.push({id,npcId:npc.id,kind:npc.quest,target,status:'active',name:npc.quest==='herbs'?npc.name+'的药材委托':npc.name+'的探路委托'});discover(s,target);message='接受'+s.quests.at(-1).name+'。完成后回到委托人所在处交付。';log(s,'quest',message);
  }else if(action.type==='complete'){
   const npc=currentNpc(data,ctx,action.npcId),q=s.quests.find(q=>q.id==='map-'+npc.id&&q.status==='active');if(!q)throw Error('没有可交付的委托');
   if(q.kind==='herbs'){removeItem(ctx,'低阶药材',3);ctx.economy.gold+=12;}else{if(!s.visited.includes(q.target))throw Error('尚未到访委托目的地');ctx.economy.gold+=8;}
   q.status='completed';s.trust[npc.id]=Math.min(100,(s.trust[npc.id]||0)+10);message='完成'+q.name+'，报酬已入账，信任增加。';log(s,'quest',message);
  }else throw Error('暂不支持该地图行动');
  const dest=node(data,s.locationId),parent=dest.root?node(data,dest.root):null;
  ctx.worldState={...ctx.worldState,location:parent?parent.name:(dest.parent||dest.name),specificSpot:dest.name,environment:dest.desc,weather:['晴 · 微风','薄云 · 轻风','晴 · 温暖'][hash(s.seed+Math.floor(s.minutes/360))%3]};
  if(action.type==='walk'&&!Nav.arrival(data,s,s.pose.sceneId,s.pose))ctx.worldState.specificSpot=dest.name+(s.pose.airborne?'附近空域':'附近道路');
  ctx.player.location=ctx.worldState.location+' · '+ctx.worldState.specificSpot;ctx.player.exploration=s;syncQuests(ctx);
  ctx.message=message;return ctx;
 }
 function promptContext(data,ctx){
  const s=ctx.state;if(!s)return '';const here=node(data,s.locationId);if(!here)return '';
  const npcs=nearbyNpcs(data,ctx).filter(n=>n.available).map(n=>n.name+'（'+n.role+'，原创地方人物，ID:'+n.id+'）').join('、');
  return '【地图已确认事实】\n地图形象：'+Nav.avatar(ctx.player.gender,s.avatarId).name+'（仅外观，不获得原著身份、能力或关系）；移动方式：'+Nav.forms[s.movementMode||'walk'].name+'\n当前位置：'+(ctx.worldState.specificSpot||here.name)+'；环境：'+here.desc+'\n行旅精力：'+s.vigor+'/100；金币：'+finite(ctx.economy.gold)+'；干粮：'+inventoryCount(ctx,'干粮')+'；水囊：'+inventoryCount(ctx,'水囊')+'\n附近可交谈人物：'+(npcs||'尚无已知人物')+'\n近期经历：'+s.journal.slice(-5).map(e=>e.text).join('；')+'\n已发现地点：'+s.discovered.filter(id=>node(data,id)).slice(-18).map(id=>node(data,id).name+'('+id+')').join('、')+'\n地图位置、物品、金币、委托结算以程序记录为准。叙事不可自动更改地图状态；秘密地点只按已获得线索提及。新增对话事实不等于已经执行旅行或交易。';
 }
 function proposal(data,ctx,text){
  const match=String(text).match(/<world_action>\s*([\s\S]{1,500}?)\s*<\/world_action>/i);if(!match)return null;
  let a;try{a=JSON.parse(match[1]);}catch{return null;}
  if(!a||typeof a!=='object'||Array.isArray(a)||!['travel','explore','rest','talk'].includes(a.type))return null;
  if(a.type==='travel'){if(!ctx.state.discovered.includes(a.targetId)||!node(data,a.targetId))return null;return {type:'travel',targetId:a.targetId,mode:['walk','convoy','flight'].includes(a.mode)?a.mode:'walk'};}
  if(a.type==='talk'){if(!nearbyNpcs(data,ctx).some(n=>n.id===a.npcId&&n.available))return null;return {type:'talk',npcId:a.npcId};}
  return {type:a.type};
 }
 return {clone,hash,rank,node,rootOf,initial,normalize,inferLocation,inventoryCount,plan,walkPlan,nearbyNpcs,transition,promptContext,proposal,gate,advance};
});
